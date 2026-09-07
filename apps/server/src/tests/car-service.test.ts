import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../utils/app-error.js';
import {
  DuplicateCar,
  type CarRecord,
  type CarRepository,
} from '../cars/repository.js';
import { createCarService } from '../cars/service.js';

const record = (change: Partial<CarRecord> = {}): CarRecord => ({
  id: 'a'.repeat(24),
  inventoryCode: 'CAR_1',
  registrationNumber: 'KA 01 AA 1000',
  registrationKey: 'KA01AA1000',
  make: 'Tata',
  makeKey: 'tata',
  model: 'Nexon',
  modelKey: 'nexon',
  year: 2025,
  category: 'suv',
  transmission: 'automatic',
  fuelType: 'electric',
  seats: 5,
  dailyRateMinor: 250000,
  currency: 'INR',
  description: 'Electric SUV',
  features: ['GPS'],
  status: 'inactive',
  revision: 0,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...change,
});
function fixture(blocked = false) {
  const car = record();
  const repository: CarRepository = {
    create: vi.fn(async () => car),
    listPublic: vi.fn(async () => ({ items: [car], totalItems: 1 })),
    findPublic: vi.fn(async () => car),
    listAdmin: vi.fn(async () => ({ items: [car], totalItems: 1 })),
    findAdmin: vi.fn(async () => car),
    replace: vi.fn(async () => ({
      result: 'updated' as const,
      car: record({ revision: 1 }),
    })),
    changeStatus: vi.fn(
      async (_i: string, _r: number, status: 'active' | 'inactive') => ({
        result: 'updated' as const,
        car: record({ status, revision: 1 }),
      }),
    ),
    softDelete: vi.fn(async () => ({
      result: 'updated' as const,
      car: record({ deletedAt: new Date(), revision: 1 }),
    })),
  };
  const events = vi.fn();
  return {
    repository,
    events,
    service: createCarService(
      repository,
      events,
      () => new Date('2026-02-01'),
      { hasBlockingBooking: vi.fn(async () => blocked) },
    ),
  };
}
const query = { sort: 'price_asc' as const, page: 1, pageSize: 20 };
describe('car service', () => {
  it('creates normalized inactive inventory', async () => {
    const f = fixture();
    const result = await f.service.create(record(), 'r');
    expect(result.status).toBe('inactive');
    expect(f.repository.create).toHaveBeenCalledOnce();
  });
  it('maps customer-safe summaries', async () => {
    const result = await fixture().service.list(query, 'r');
    expect(Object.keys(result.items[0]!).sort()).not.toContain(
      'registrationNumber',
    );
  });
  it('maps administrator-safe DTOs', async () => {
    const result = await fixture().service.adminDetail('a'.repeat(24), 'r');
    expect(result).toMatchObject({
      registrationNumber: 'KA 01 AA 1000',
      revision: 0,
    });
  });
  it('omits normalization and deletion fields', async () => {
    const result = await fixture().service.adminDetail('a'.repeat(24), 'r');
    expect(result).not.toHaveProperty('registrationKey');
    expect(result).not.toHaveProperty('deletedAt');
  });
  it('returns bounded pagination', async () =>
    expect(await fixture().service.list(query, 'r')).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    }));
  it('hides missing public detail', async () => {
    const f = fixture();
    vi.mocked(f.repository.findPublic).mockResolvedValue(null);
    await expect(f.service.detail('a'.repeat(24), 'r')).rejects.toMatchObject({
      status: 404,
      code: 'CAR_NOT_FOUND',
    });
  });
  it('maps duplicate identifiers to conflict', async () => {
    const f = fixture();
    vi.mocked(f.repository.create).mockRejectedValue(new DuplicateCar());
    await expect(f.service.create(record(), 'r')).rejects.toMatchObject({
      status: 409,
      code: 'CAR_CONFLICT',
    });
  });
  it('updates with the expected revision', async () => {
    const f = fixture();
    const value = record();
    await f.service.replace(value.id, 0, value, 'r');
    expect(f.repository.replace).toHaveBeenCalledWith(value.id, 0, value);
  });
  it('rejects stale revisions', async () => {
    const f = fixture();
    vi.mocked(f.repository.replace).mockResolvedValue({ result: 'conflict' });
    await expect(
      f.service.replace('a'.repeat(24), 0, record(), 'r'),
    ).rejects.toMatchObject({ code: 'CAR_CONFLICT' });
  });
  it('activates inactive inventory', async () =>
    expect(
      (await fixture().service.changeStatus('a'.repeat(24), 0, 'active', 'r'))
        .status,
    ).toBe('active'));
  it('deactivates active inventory', async () =>
    expect(
      (await fixture().service.changeStatus('a'.repeat(24), 0, 'inactive', 'r'))
        .status,
    ).toBe('inactive'));
  it('rejects deletion of active inventory', async () => {
    const f = fixture();
    vi.mocked(f.repository.softDelete).mockResolvedValue({ result: 'active' });
    await expect(
      f.service.remove('a'.repeat(24), 0, 'r'),
    ).rejects.toMatchObject({ code: 'CAR_MUST_BE_INACTIVE' });
  });
  it('soft deletes inactive inventory', async () =>
    expect(
      (await fixture().service.remove('a'.repeat(24), 0, 'r')).revision,
    ).toBe(1));
  it('emits safe events and sanitizes failures', async () => {
    const f = fixture();
    vi.mocked(f.repository.findAdmin).mockRejectedValue(new Error('private'));
    await expect(f.service.adminDetail('a'.repeat(24), 'r')).rejects.toEqual(
      new AppError(
        503,
        'CAR_UNAVAILABLE',
        'Car inventory is temporarily unavailable',
      ),
    );
    expect(f.events).toHaveBeenCalledWith({
      event: 'CAR_OPERATION_FAILED',
      outcome: 'failure',
      requestId: 'r',
      operation: 'admin-detail',
    });
  });
});
describe('booking-aware car deletion', () => {
  it('allows deletion without blocking bookings', async () =>
    expect(
      fixture(false).service.remove('a'.repeat(24), 0, 'r'),
    ).resolves.toBeDefined());
  it('blocks a current pending booking', async () =>
    expect(
      fixture(true).service.remove('a'.repeat(24), 0, 'r'),
    ).rejects.toMatchObject({ code: 'CAR_HAS_BOOKINGS' }));
  it('blocks a future confirmed booking', async () =>
    expect(
      fixture(true).service.remove('a'.repeat(24), 0, 'r'),
    ).rejects.toMatchObject({ status: 409 }));
  it('permits deletion when terminal and ended bookings do not block', async () =>
    expect(
      fixture(false).service.remove('a'.repeat(24), 0, 'r'),
    ).resolves.toMatchObject({ revision: 1 }));
});
