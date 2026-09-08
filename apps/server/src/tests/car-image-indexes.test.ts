import { describe, expect, it, vi } from 'vitest';
import {
  expectedCarImageIndexes,
  provisionCarImageIndexes,
  verifyCarImageIndexes,
} from '../car-images/indexes.js';
const model = (indexes: unknown[]) => ({
  collection: {
    indexes: vi
      .fn()
      .mockResolvedValue([{ name: '_id_', key: { _id: 1 } }, ...indexes]),
  },
  createCollection: vi.fn(),
  createIndexes: vi.fn(),
});
const expected = (items: readonly object[]) =>
  items.map((value) => ({ ...value }));
describe('car image indexes', () => {
  it('defines ten named indexes', () =>
    expect(Object.values(expectedCarImageIndexes).flat()).toHaveLength(10));
  it('defines seven image indexes', () =>
    expect(expectedCarImageIndexes.images).toHaveLength(7));
  it('defines one image-set index', () =>
    expect(expectedCarImageIndexes.sets).toHaveLength(1));
  it('defines two event indexes', () =>
    expect(expectedCarImageIndexes.events).toHaveLength(2));
  it('makes public ids unique', () =>
    expect(expectedCarImageIndexes.images[0].unique).toBe(true));
  it('makes quarantine keys unique', () =>
    expect(expectedCarImageIndexes.images[1].unique).toBe(true));
  it('uses a partial ready-key index', () =>
    expect(expectedCarImageIndexes.images[2]).toHaveProperty(
      'partialFilterExpression',
    ));
  it('orders car images deterministically', () =>
    expect(expectedCarImageIndexes.images[3].key).toEqual({
      carId: 1,
      status: 1,
      displayOrder: 1,
      _id: 1,
    }));
  it('makes live display positions unique', () =>
    expect(expectedCarImageIndexes.images[4].unique).toBe(true));
  it('makes each ready primary unique', () =>
    expect(expectedCarImageIndexes.images[5].unique).toBe(true));
  it('verifies every collection independently', async () => {
    const models = {
      images: model(expected(expectedCarImageIndexes.images)),
      sets: model(expected(expectedCarImageIndexes.sets)),
      events: model(expected(expectedCarImageIndexes.events)),
    };
    await expect(
      verifyCarImageIndexes(models as never),
    ).resolves.toBeUndefined();
    expect(models.images.collection.indexes).toHaveBeenCalledOnce();
    expect(models.sets.collection.indexes).toHaveBeenCalledOnce();
    expect(models.events.collection.indexes).toHaveBeenCalledOnce();
  });
  it('provisions non-destructively', async () => {
    const models = {
      images: model(expected(expectedCarImageIndexes.images)),
      sets: model(expected(expectedCarImageIndexes.sets)),
      events: model(expected(expectedCarImageIndexes.events)),
    };
    await provisionCarImageIndexes(models as never);
    expect(models.images.createIndexes).toHaveBeenCalledOnce();
    expect(models.sets.createCollection).toHaveBeenCalledOnce();
    expect(models.events.createIndexes).toHaveBeenCalledOnce();
  });
});
