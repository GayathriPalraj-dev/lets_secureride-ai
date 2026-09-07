import { describe, expect, it, vi } from 'vitest';
import {
  expectedCarIndexes,
  provisionCarIndexes,
  verifyCarIndexes,
  type CarModels,
} from '../cars/indexes.js';
import { runCarIndexCommand } from '../scripts/car-indexes.js';

function fixture() {
  const indexes = vi
    .fn()
    .mockResolvedValue(expectedCarIndexes.map((index) => ({ ...index })));
  const cars = {
    collection: { indexes },
    createCollection: vi.fn(),
    createIndexes: vi.fn(),
  };
  return { cars, models: { cars } as unknown as CarModels };
}
function altered(name: string, change: object) {
  return expectedCarIndexes.map((index) =>
    index.name === name ? { ...index, ...change } : index,
  );
}
describe('explicit car indexes', () => {
  it('checks all expected indexes without mutation', async () => {
    const f = fixture();
    await verifyCarIndexes(f.models);
    expect(f.cars.collection.indexes).toHaveBeenCalledOnce();
    expect(f.cars.createCollection).not.toHaveBeenCalled();
    expect(f.cars.createIndexes).not.toHaveBeenCalled();
  });
  it('rejects a missing unique inventory index', async () => {
    const f = fixture();
    f.cars.collection.indexes.mockResolvedValue(expectedCarIndexes.slice(1));
    await expect(verifyCarIndexes(f.models)).rejects.toThrow(
      'Car indexes are unavailable',
    );
  });
  it('rejects a nonunique inventory index', async () => {
    const f = fixture();
    f.cars.collection.indexes.mockResolvedValue(
      altered('car_inventory_code_unique', { unique: false }),
    );
    await expect(verifyCarIndexes(f.models)).rejects.toThrow();
  });
  it('rejects an incorrect registration index key', async () => {
    const f = fixture();
    f.cars.collection.indexes.mockResolvedValue(
      altered('car_registration_unique', { key: { registrationNumber: 1 } }),
    );
    await expect(verifyCarIndexes(f.models)).rejects.toThrow();
  });
  it('rejects a nonunique registration index', async () => {
    const f = fixture();
    f.cars.collection.indexes.mockResolvedValue(
      altered('car_registration_unique', { unique: false }),
    );
    await expect(verifyCarIndexes(f.models)).rejects.toThrow();
  });
  it('rejects incorrect customer or admin index key order', async () => {
    for (const name of [
      'car_public_price_listing',
      'car_public_make_listing',
      'car_admin_inventory_listing',
    ]) {
      const f = fixture();
      const expected = expectedCarIndexes.find((index) => index.name === name)!;
      f.cars.collection.indexes.mockResolvedValue(
        altered(name, {
          key: Object.fromEntries(Object.entries(expected.key).reverse()),
        }),
      );
      await expect(verifyCarIndexes(f.models)).rejects.toThrow();
    }
  });
  it('rejects incompatible sparse partial TTL or collation options', async () => {
    for (const option of [
      { sparse: true },
      { partialFilterExpression: { status: 'active' } },
      { expireAfterSeconds: 0 },
      { collation: { locale: 'en' } },
    ]) {
      const f = fixture();
      f.cars.collection.indexes.mockResolvedValue(
        altered('car_public_price_listing', option),
      );
      await expect(verifyCarIndexes(f.models)).rejects.toThrow();
    }
  });
  it('sanitizes database driver failures', async () => {
    const f = fixture();
    f.cars.collection.indexes.mockRejectedValue(
      new Error('private-driver-detail'),
    );
    const failure = verifyCarIndexes(f.models);
    await expect(failure).rejects.toThrow('Car indexes are unavailable');
    await expect(failure).rejects.not.toThrow('private-driver-detail');
  });
  it('applies only explicit approved create operations', async () => {
    const f = fixture();
    await provisionCarIndexes(f.models);
    expect(f.cars.createCollection).toHaveBeenCalledOnce();
    expect(f.cars.createIndexes).toHaveBeenCalledOnce();
    expect(Object.keys(f.cars).sort()).toEqual([
      'collection',
      'createCollection',
      'createIndexes',
    ]);
  });
  it('verifies independently after apply and closes resources', async () => {
    const f = fixture();
    const open = vi.fn();
    const close = vi.fn();
    const unsubscribe = vi.fn();
    const write = vi.fn();
    const result = await runCarIndexCommand('--apply', {
      open,
      close,
      unsubscribe,
      models: f.models,
      write,
    });
    expect(result).toBe(0);
    expect(open).toHaveBeenCalledOnce();
    expect(f.cars.collection.indexes).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
