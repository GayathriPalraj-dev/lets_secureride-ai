import { z } from 'zod';
import { AppError } from '../utils/app-error.js';
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const page = z.coerce.number().int().min(1).max(100000);
const pageSize = z.coerce.number().int().min(1).max(100);
export const emptyPaymentSchema = z.object({}).strict();
export const refundSchema = z
  .object({ reason: z.string().trim().min(1).max(300).optional() })
  .strict();
export const paymentListSchema = z
  .object({
    status: z
      .enum([
        'initializing',
        'requires_payment_method',
        'requires_action',
        'processing',
        'succeeded',
        'canceled',
        'reconciliation_required',
        'all',
      ])
      .default('all'),
    page: page.default(1),
    pageSize: pageSize.default(20),
  })
  .strict();
export const adminPaymentListSchema = paymentListSchema
  .extend({
    refundStatus: z
      .enum(['none', 'required', 'pending', 'succeeded', 'failed', 'all'])
      .default('all'),
    reconciliationState: z
      .enum(['none', 'required', 'in_progress', 'failed', 'all'])
      .default('all'),
  })
  .strict();
export const paymentId = (value: unknown) => parsePayment(objectId, value);
export const paymentRevision = (value: unknown) => {
  if (typeof value !== 'string' || !/^"(?:0|[1-9]\d*)"$/.test(value))
    throw new AppError(
      428,
      'PRECONDITION_REQUIRED',
      'A current quoted If-Match header is required',
    );
  return Number(value.slice(1, -1));
};
export function parsePayment<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(400, 'VALIDATION_FAILED', 'Request validation failed');
  return result.data;
}
