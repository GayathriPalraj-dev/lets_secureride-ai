import { describe, expect, it } from 'vitest';
import {
  bookingDatesSchema,
  bookingId,
  bookingRevision,
  bookingListSchema,
  reasonSchema,
} from '../bookings/validation.js';
const today = () => new Date().toISOString().slice(0, 10);
describe('booking validation', () => {
  it.each([
    ['id', () => bookingId('a'.repeat(24))],
    ['etag', () => bookingRevision('"0"')],
    ['list', () => bookingListSchema.parse({})],
    ['reason', () => reasonSchema.parse({ reason: 'safe' })],
  ])('accepts %s', (_n, fn) => expect(fn).not.toThrow());
  it.each([
    ['bad-id', () => bookingId('x')],
    ['bad-etag', () => bookingRevision('0')],
    ['operator', () => bookingListSchema.parse({ status: { $ne: 'x' } })],
    ['reason-long', () => reasonSchema.parse({ reason: 'x'.repeat(301) })],
    [
      'timestamp',
      () =>
        bookingDatesSchema.parse({
          carId: 'a'.repeat(24),
          startDate: today() + 'T00:00Z',
          endDateExclusive: today(),
        }),
    ],
    [
      'same-day',
      () =>
        bookingDatesSchema.parse({
          carId: 'a'.repeat(24),
          startDate: today(),
          endDateExclusive: today(),
        }),
    ],
    [
      'impossible',
      () =>
        bookingDatesSchema.parse({
          carId: 'a'.repeat(24),
          startDate: '2027-02-29',
          endDateExclusive: '2027-03-01',
        }),
    ],
    ['unknown', () => reasonSchema.parse({ raw: true })],
  ])('rejects %s', (_n, fn) => expect(fn).toThrow());
});
