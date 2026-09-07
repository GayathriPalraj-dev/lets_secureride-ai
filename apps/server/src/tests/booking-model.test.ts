import { describe, expect, it } from 'vitest';
import { bookingSchema } from '../models/booking.js';
describe('booking model', () => {
  it.each([
    'userId',
    'carId',
    'startDate',
    'endDateExclusive',
    'dailyRateMinor',
    'billableDays',
    'totalAmountMinor',
    'status',
  ] as const)('defines required field %s', (field) =>
    expect(bookingSchema.path(field).options.required).toBe(true),
  );
});
