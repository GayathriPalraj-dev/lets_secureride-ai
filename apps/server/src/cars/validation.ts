import { z } from 'zod';
import type {
  CreateCarRequest,
  UpdateCarRequest,
} from '@lets-secureride-ai/contracts';
import { AppError } from '../utils/app-error.js';

const display = (maximum: number) => z.string().trim().min(1).max(maximum);
const inventoryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/);
const registrationNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9 -]{2,31}$/);
const category = z.enum(['hatchback', 'sedan', 'suv', 'luxury', 'van']);
const transmission = z.enum(['manual', 'automatic']);
const fuelType = z.enum(['petrol', 'diesel', 'electric', 'hybrid']);
const year = z
  .number()
  .int()
  .min(1990)
  .max(new Date().getFullYear() + 1);
const features = z
  .array(display(60))
  .max(20)
  .transform((values) => [...new Set(values)]);
const editableFields = {
  make: display(60),
  model: display(60),
  year,
  category,
  transmission,
  fuelType,
  seats: z.number().int().min(1).max(12),
  dailyRateMinor: z.number().int().min(1).max(100_000_000),
  description: display(2000),
  features,
};

export const createCarSchema = z.strictObject({
  inventoryCode,
  registrationNumber,
  ...editableFields,
}) satisfies z.ZodType<CreateCarRequest>;
export const updateCarSchema = z.strictObject(
  editableFields,
) satisfies z.ZodType<UpdateCarRequest>;

const queryInteger = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum);
export const carListQuerySchema = z.strictObject({
  make: display(60)
    .transform((value) => value.toLowerCase())
    .optional(),
  category: category.optional(),
  transmission: transmission.optional(),
  fuelType: fuelType.optional(),
  minSeats: queryInteger(1, 12).optional(),
  maxDailyRateMinor: queryInteger(1, 100_000_000).optional(),
  sort: z
    .enum(['price_asc', 'price_desc', 'year_desc', 'make_asc'])
    .default('price_asc'),
  page: queryInteger(1, 100).default(1),
  pageSize: queryInteger(1, 50).default(20),
});
export const adminCarListQuerySchema = z.strictObject({
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  inventoryCode: inventoryCode.optional(),
  sort: z.enum(['updated_desc', 'make_asc']).default('updated_desc'),
  page: queryInteger(1, 100).default(1),
  pageSize: queryInteger(1, 50).default(20),
});

export interface CarPersistenceKeys {
  registrationKey: string;
  makeKey: string;
  modelKey: string;
}
export function deriveCarKeys(
  value: Pick<CreateCarRequest, 'registrationNumber' | 'make' | 'model'>,
): CarPersistenceKeys {
  return {
    registrationKey: value.registrationNumber
      .replace(/[ -]/g, '')
      .toUpperCase(),
    makeKey: value.make.trim().toLowerCase(),
    modelKey: value.model.trim().toLowerCase(),
  };
}
export function validateCar<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(400, 'INVALID_INPUT', 'Request fields are invalid');
  return result.data;
}
export function validateCarId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))
    throw new AppError(400, 'INVALID_INPUT', 'Request fields are invalid');
  return value.toLowerCase();
}
export function parseIfMatch(value: unknown): number {
  if (typeof value !== 'string' || !/^"(?:0|[1-9]\d*)"$/.test(value))
    throw new AppError(400, 'INVALID_INPUT', 'A valid revision is required');
  const parsed = Number(value.slice(1, -1));
  if (!Number.isSafeInteger(parsed))
    throw new AppError(400, 'INVALID_INPUT', 'A valid revision is required');
  return parsed;
}
