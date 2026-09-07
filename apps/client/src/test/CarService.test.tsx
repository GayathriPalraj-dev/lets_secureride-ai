import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarError, createCarRequests } from '../services/cars';
const detail = {
  id: 'a'.repeat(24),
  inventoryCode: 'CAR-001',
  make: 'Tata',
  model: 'Nexon',
  year: 2025,
  category: 'suv',
  transmission: 'automatic',
  fuelType: 'electric',
  seats: 5,
  dailyRate: { amountMinor: 250000, currency: 'INR' },
  description: 'Safe car',
  features: ['ABS'],
};
const admin = {
  ...detail,
  registrationNumber: 'KA01AB1234',
  status: 'active',
  revision: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
function reply(data: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      status,
      json: async () => ({
        success: ok,
        data,
        requestId: 'request-1',
        ...(!ok ? { error: { code: 'FAILED', message: 'safe' } } : {}),
      }),
    })),
  );
}
describe('car service', () => {
  beforeEach(() => reply({ car: detail }));
  it('lists customer cars', async () => {
    reply({
      items: [detail],
      page: 1,
      pageSize: 12,
      totalItems: 1,
      totalPages: 1,
    });
    expect((await createCarRequests().list('token')).items).toHaveLength(1);
  });
  it('serializes filters', async () => {
    reply({ items: [], page: 1, pageSize: 12, totalItems: 0, totalPages: 0 });
    await createCarRequests().list('token', { make: 'Tata', page: 1 });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('make=Tata'),
      expect.anything(),
    );
  });
  it('gets customer detail', async () =>
    expect((await createCarRequests().detail('token', detail.id)).model).toBe(
      'Nexon',
    ));
  it('rejects disclosed admin fields', async () => {
    reply({ car: admin });
    await expect(
      createCarRequests().detail('token', detail.id),
    ).rejects.toBeInstanceOf(CarError);
  });
  it('lists admin cars', async () => {
    reply({
      items: [admin],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
    expect(
      (await createCarRequests().adminList('token')).items[0]?.revision,
    ).toBe(2);
  });
  it('gets admin detail', async () => {
    reply({ car: admin });
    expect(
      (await createCarRequests().adminDetail('token', detail.id))
        .registrationNumber,
    ).toBe('KA01AB1234');
  });
  it('creates a car with CSRF', async () => {
    reply({ car: admin });
    await createCarRequests().create('token', {
      inventoryCode: 'CAR-001',
      registrationNumber: 'KA01AB1234',
      make: 'Tata',
      model: 'Nexon',
      year: 2025,
      category: 'suv',
      transmission: 'automatic',
      fuelType: 'electric',
      seats: 5,
      dailyRateMinor: 250000,
      description: 'Safe car',
      features: [],
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-CSRF-Protection': '1' }),
      }),
    );
  });
  it('replaces with If-Match', async () => {
    reply({ car: admin });
    const body = {
      make: 'Tata',
      model: 'Nexon',
      year: 2025,
      category: 'suv' as const,
      transmission: 'automatic' as const,
      fuelType: 'electric' as const,
      seats: 5,
      dailyRateMinor: 1,
      description: 'Safe',
      features: [],
    };
    await createCarRequests().replace('token', detail.id, 2, body);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'If-Match': '"2"' }),
      }),
    );
  });
  it('activates a car', async () => {
    reply({ car: admin });
    await createCarRequests().status('token', detail.id, 2, 'active');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/activate'),
      expect.anything(),
    );
  });
  it('deletes a car', async () => {
    reply({ car: admin });
    await createCarRequests().remove('token', detail.id, 2);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
  it('maps safe HTTP failures', async () => {
    reply({}, false, 409);
    await expect(
      createCarRequests().detail('token', detail.id),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('maps invalid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('bad');
        },
      })),
    );
    await expect(
      createCarRequests().detail('token', detail.id),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
