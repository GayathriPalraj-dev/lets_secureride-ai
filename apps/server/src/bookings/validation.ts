import { z } from 'zod';
import { AppError } from '../utils/app-error.js';
import { DAY_MS } from './pricing.js';
const id = z
  .string()
  .regex(/^[a-f\d]{24}$/i)
  .transform((x) => x.toLowerCase());
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value, ctx) => {
    const d = new Date(value + 'T00:00:00.000Z');
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
      ctx.addIssue({ code: 'custom', message: 'Invalid date' });
      return z.NEVER;
    }
    return d;
  });
export const bookingDatesSchema = z
  .strictObject({ carId: id, startDate: date, endDateExclusive: date })
  .superRefine((v, ctx) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const days =
      (v.endDateExclusive.getTime() - v.startDate.getTime()) / DAY_MS;
    if (
      v.startDate < today ||
      v.startDate.getTime() > today.getTime() + 365 * DAY_MS ||
      days < 1 ||
      days > 30
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid range' });
  });
const qi = (a: number, b: number) => z.coerce.number().int().min(a).max(b);
const status = z.enum(['pending', 'confirmed', 'rejected', 'cancelled']);
export const bookingListSchema = z.strictObject({
  status: z.union([status, z.literal('all')]).default('all'),
  sort: z.enum(['created_desc', 'start_asc']).default('created_desc'),
  page: qi(1, 100).default(1),
  pageSize: qi(1, 50).default(20),
});
export const adminBookingListSchema = bookingListSchema
  .extend({
    carId: id.optional(),
    startFrom: date.optional(),
    startBefore: date.optional(),
  })
  .strict();
export const reasonSchema = z.strictObject({
  reason: z.string().trim().min(1).max(300).optional(),
});
export const emptySchema = z.strictObject({});
export function parseBooking<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success)
    throw new AppError(400, 'INVALID_INPUT', 'Request fields are invalid');
  return r.data;
}
export function bookingId(value: unknown) {
  return parseBooking(id, value);
}
export function bookingRevision(value: unknown) {
  if (typeof value !== 'string' || !/^"(?:0|[1-9]\d*)"$/.test(value))
    throw new AppError(400, 'INVALID_INPUT', 'A valid revision is required');
  const n = Number(value.slice(1, -1));
  if (!Number.isSafeInteger(n))
    throw new AppError(400, 'INVALID_INPUT', 'A valid revision is required');
  return n;
}
