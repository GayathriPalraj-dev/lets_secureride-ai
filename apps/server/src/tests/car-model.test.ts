import { Mongoose } from 'mongoose';
import { afterEach, describe, expect, it } from 'vitest';
import { createCarModel } from '../models/car.js';

const instances: Mongoose[] = [];
function model() {
  const instance = new Mongoose();
  instances.push(instance);
  return createCarModel(instance.createConnection());
}
function valid() {
  return {
    inventoryCode: ' car_1 ',
    registrationNumber: ' ka 01 aa 1000 ',
    registrationKey: ' ka01aa1000 ',
    make: ' Tata ',
    makeKey: ' TATA ',
    model: ' Nexon ',
    modelKey: ' NEXON ',
    year: 2025,
    category: 'suv',
    transmission: 'automatic',
    fuelType: 'electric',
    seats: 5,
    dailyRateMinor: 250000,
    currency: 'INR',
    description: ' Electric SUV ',
    features: ['GPS', 'Air bags'],
  };
}
afterEach(async () => {
  for (const instance of instances.splice(0)) {
    await instance.disconnect();
    for (const connection of instance.connections) connection.deleteModel(/.*/);
  }
});

describe('car model', () => {
  it('uses the cars collection and strict schema', () => {
    const m = model();
    expect(m.collection.name).toBe('cars');
    expect(m.schema.options.strict).toBe('throw');
  });
  it('disables automatic collection and index creation', () => {
    const s = model().schema.options;
    expect(s.autoCreate).toBe(false);
    expect(s.autoIndex).toBe(false);
  });
  it('requires every durable business field', () => {
    const error = new (model())({}).validateSync();
    for (const field of [
      'inventoryCode',
      'registrationNumber',
      'registrationKey',
      'make',
      'makeKey',
      'model',
      'modelKey',
      'year',
      'category',
      'transmission',
      'fuelType',
      'seats',
      'dailyRateMinor',
      'description',
      'features',
    ])
      expect(error?.errors[field]).toBeDefined();
  });
  it('enforces approved enum values', () => {
    const error = new (model())({
      ...valid(),
      category: 'truck',
      transmission: 'cvt',
      fuelType: 'steam',
      currency: 'USD',
      status: 'retired',
    }).validateSync();
    for (const field of [
      'category',
      'transmission',
      'fuelType',
      'currency',
      'status',
    ])
      expect(error?.errors[field]).toBeDefined();
  });
  it('enforces numeric and year bounds', () => {
    const error = new (model())({
      ...valid(),
      year: 1989,
      seats: 13,
      dailyRateMinor: 0,
      revision: -1,
    }).validateSync();
    for (const field of ['year', 'seats', 'dailyRateMinor', 'revision'])
      expect(error?.errors[field]).toBeDefined();
  });
  it('initializes normalized inactive status and revision safely', () => {
    const car = new (model())(valid());
    expect(car.inventoryCode).toBe('CAR_1');
    expect(car.registrationKey).toBe('KA01AA1000');
    expect(car.makeKey).toBe('tata');
    expect(car.status).toBe('inactive');
    expect(car.revision).toBe(0);
  });
  it('declares timestamps and nullable soft deletion state', () => {
    const car = new (model())(valid());
    expect(car.deletedAt).toBeNull();
    expect(model().schema.options.timestamps).toBe(true);
  });
  it('declares the five exact named indexes', () => {
    const indexes = model()
      .schema.indexes()
      .map(([key, options]) => ({
        key,
        name: options.name,
        unique: Boolean(options.unique),
      }));
    expect(indexes).toEqual([
      {
        key: { inventoryCode: 1 },
        name: 'car_inventory_code_unique',
        unique: true,
      },
      {
        key: { registrationKey: 1 },
        name: 'car_registration_unique',
        unique: true,
      },
      {
        key: {
          status: 1,
          deletedAt: 1,
          category: 1,
          dailyRateMinor: 1,
          _id: 1,
        },
        name: 'car_public_price_listing',
        unique: false,
      },
      {
        key: { status: 1, deletedAt: 1, makeKey: 1, modelKey: 1, _id: 1 },
        name: 'car_public_make_listing',
        unique: false,
      },
      {
        key: { deletedAt: 1, status: 1, updatedAt: -1, _id: 1 },
        name: 'car_admin_inventory_listing',
        unique: false,
      },
    ]);
  });
});
