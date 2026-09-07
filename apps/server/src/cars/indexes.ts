import type { Model } from 'mongoose';

export interface CarModels {
  cars: Model<unknown>;
}

export const expectedCarIndexes = [
  {
    name: 'car_inventory_code_unique',
    key: { inventoryCode: 1 },
    unique: true,
  },
  {
    name: 'car_registration_unique',
    key: { registrationKey: 1 },
    unique: true,
  },
  {
    name: 'car_public_price_listing',
    key: {
      status: 1,
      deletedAt: 1,
      category: 1,
      dailyRateMinor: 1,
      _id: 1,
    },
  },
  {
    name: 'car_public_make_listing',
    key: { status: 1, deletedAt: 1, makeKey: 1, modelKey: 1, _id: 1 },
  },
  {
    name: 'car_admin_inventory_listing',
    key: { deletedAt: 1, status: 1, updatedAt: -1, _id: 1 },
  },
] as const;

export async function verifyCarIndexes(models: CarModels): Promise<void> {
  try {
    const actual = await models.cars.collection.indexes();
    for (const expected of expectedCarIndexes) {
      const found = actual.find((index) => index.name === expected.name);
      if (
        !found ||
        JSON.stringify(found.key) !== JSON.stringify(expected.key) ||
        Boolean(found.unique) !== 'unique' in expected ||
        found.sparse ||
        found.partialFilterExpression ||
        found.collation ||
        found.expireAfterSeconds !== undefined
      ) {
        throw new Error('Car indexes are unavailable');
      }
    }
  } catch {
    throw new Error('Car indexes are unavailable');
  }
}

export async function provisionCarIndexes(models: CarModels): Promise<void> {
  // Explicit operator command only. Never drop or synchronize indexes.
  await models.cars.createCollection();
  await models.cars.createIndexes();
  await verifyCarIndexes(models);
}
