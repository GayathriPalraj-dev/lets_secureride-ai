import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createCarService } from '../cars/service.js';
const car = {
  id: '507f1f77bcf86cd799439011',
  inventoryCode: 'CAR-1',
  registrationNumber: 'TN01AA0001',
  registrationKey: 'TN01AA0001',
  make: 'Tata',
  makeKey: 'tata',
  model: 'Nexon',
  modelKey: 'nexon',
  year: 2025,
  category: 'suv' as const,
  transmission: 'automatic' as const,
  fuelType: 'electric' as const,
  seats: 5,
  dailyRateMinor: 1000,
  currency: 'INR' as const,
  description: 'Safe car',
  features: [],
  status: 'inactive' as const,
  revision: 0,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const repository = {
  create: vi.fn(),
  listPublic: vi.fn(),
  findPublic: vi.fn(),
  listAdmin: vi.fn(),
  findAdmin: vi.fn(),
  replace: vi.fn(),
  changeStatus: vi.fn(),
  softDelete: vi.fn().mockResolvedValue({ result: 'updated', car }),
};
describe('car deletion image guard', () => {
  it('blocks deletion while live images exist', async () => {
    const service = createCarService(
      repository as never,
      vi.fn(),
      () => new Date(),
      { hasBlockingBooking: vi.fn().mockResolvedValue(false) },
      { hasLive: vi.fn().mockResolvedValue(true) },
    );
    await expect(service.remove(car.id, 0, 'r')).rejects.toMatchObject({
      code: 'CAR_HAS_IMAGES',
    });
    expect(repository.softDelete).not.toHaveBeenCalled();
  });
  it('wires the production car service to the existing image repository', () => {
    const source = readFileSync(
      new URL('../server.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain(
      '{ hasLive: (carId) => imageRepository.hasLive(carId) }',
    );
  });
  it('deletes when both guards are clear', async () => {
    const service = createCarService(
      repository as never,
      vi.fn(),
      () => new Date(),
      { hasBlockingBooking: vi.fn().mockResolvedValue(false) },
      { hasLive: vi.fn().mockResolvedValue(false) },
    );
    await expect(service.remove(car.id, 0, 'r')).resolves.toMatchObject({
      id: car.id,
    });
    expect(repository.softDelete).toHaveBeenCalled();
  });
  it('maps image guard failures to safe unavailability', async () => {
    const service = createCarService(
      repository as never,
      vi.fn(),
      () => new Date(),
      { hasBlockingBooking: vi.fn().mockResolvedValue(false) },
      { hasLive: vi.fn().mockRejectedValue(new Error('private')) },
    );
    await expect(service.remove(car.id, 0, 'r')).rejects.toMatchObject({
      code: 'CAR_UNAVAILABLE',
    });
  });
});
