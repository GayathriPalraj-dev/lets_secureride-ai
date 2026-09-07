import { describe, expect, it } from 'vitest';
import {
  adminCarListQuerySchema,
  carListQuerySchema,
  createCarSchema,
  deriveCarKeys,
  parseIfMatch,
  updateCarSchema,
  validateCarId,
} from '../cars/validation.js';

const valid = () => ({
  inventoryCode: 'CAR_1',
  registrationNumber: 'KA 01 AA 1000',
  make: 'Tata',
  model: 'Nexon',
  year: 2025,
  category: 'suv',
  transmission: 'automatic',
  fuelType: 'electric',
  seats: 5,
  dailyRateMinor: 250000,
  description: 'Electric SUV',
  features: ['GPS'],
});
const update = () => {
  const value: Partial<ReturnType<typeof valid>> = valid();
  delete value.inventoryCode;
  delete value.registrationNumber;
  return value;
};

describe('car validation', () => {
  it('accepts a valid create body', () =>
    expect(createCarSchema.parse(valid())).toEqual(valid()));
  it('rejects unknown create fields', () =>
    expect(() =>
      createCarSchema.parse({ ...valid(), operator: { $gt: '' } }),
    ).toThrow());
  it('normalizes inventory and registration values', () => {
    const value = createCarSchema.parse({
      ...valid(),
      inventoryCode: ' car_1 ',
      registrationNumber: ' ka 01 aa 1000 ',
    });
    expect(value.inventoryCode).toBe('CAR_1');
    expect(value.registrationNumber).toBe('KA 01 AA 1000');
    expect(deriveCarKeys(value)).toEqual({
      registrationKey: 'KA01AA1000',
      makeKey: 'tata',
      modelKey: 'nexon',
    });
  });
  it('rejects invalid inventory codes', () => {
    for (const value of ['A', 'bad code', '*CAR'])
      expect(() =>
        createCarSchema.parse({ ...valid(), inventoryCode: value }),
      ).toThrow();
  });
  it('rejects invalid registration values', () => {
    for (const value of ['A', 'KA@01', '    '])
      expect(() =>
        createCarSchema.parse({ ...valid(), registrationNumber: value }),
      ).toThrow();
  });
  it('rejects invalid display lengths', () => {
    for (const value of [
      { make: '' },
      { model: 'x'.repeat(61) },
      { description: 'x'.repeat(2001) },
    ])
      expect(() => createCarSchema.parse({ ...valid(), ...value })).toThrow();
  });
  it('rejects invalid numeric values', () => {
    for (const value of [
      { year: 1989 },
      { year: 2025.5 },
      { dailyRateMinor: 0 },
      { seats: 13 },
    ])
      expect(() => createCarSchema.parse({ ...valid(), ...value })).toThrow();
  });
  it('rejects unsupported enums', () => {
    for (const value of [
      { category: 'truck' },
      { transmission: 'cvt' },
      { fuelType: 'steam' },
    ])
      expect(() => createCarSchema.parse({ ...valid(), ...value })).toThrow();
  });
  it('normalizes and bounds features', () => {
    expect(
      createCarSchema.parse({ ...valid(), features: [' GPS ', 'GPS'] })
        .features,
    ).toEqual(['GPS']);
    expect(() =>
      createCarSchema.parse({ ...valid(), features: [''] }),
    ).toThrow();
    expect(() =>
      createCarSchema.parse({
        ...valid(),
        features: Array.from({ length: 21 }, (_, i) => `f${i}`),
      }),
    ).toThrow();
  });
  it('validates filters and pagination', () => {
    expect(carListQuerySchema.parse({ make: ' TATA ' })).toMatchObject({
      make: 'tata',
      page: 1,
      pageSize: 20,
    });
    expect(
      adminCarListQuerySchema.parse({ inventoryCode: ' car_1 ' }),
    ).toMatchObject({ inventoryCode: 'CAR_1' });
    expect(() => carListQuerySchema.parse({ page: 101 })).toThrow();
  });
  it('allows only approved sorts', () => {
    for (const sort of ['price_asc', 'price_desc', 'year_desc', 'make_asc'])
      expect(carListQuerySchema.parse({ sort }).sort).toBe(sort);
    expect(() => carListQuerySchema.parse({ sort: 'random' })).toThrow();
  });
  it('validates IDs immutable updates and revisions', () => {
    expect(validateCarId('A'.repeat(24))).toBe('a'.repeat(24));
    expect(() => validateCarId('bad')).toThrow();
    expect(parseIfMatch('"42"')).toBe(42);
    for (const value of ['*', 'W/"1"', '-1', '1', '"1.2"'])
      expect(() => parseIfMatch(value)).toThrow();
    for (const field of [
      'inventoryCode',
      'registrationNumber',
      'registrationKey',
      'makeKey',
      'status',
      'revision',
      'deletedAt',
      'createdAt',
    ])
      expect(() =>
        updateCarSchema.parse({ ...update(), [field]: 'x' }),
      ).toThrow();
  });
});
