import { describe, expect, it } from 'vitest';
import { bookingPrice, DAY_MS } from '../bookings/pricing.js';
describe('booking pricing', () => {
  it.each([
    [1, 100],
    [2, 200],
    [3, 300],
    [30, 3000],
  ])('prices %i days', (days, total) =>
    expect(
      bookingPrice(100, new Date(0), new Date(days * DAY_MS)).totalAmountMinor,
    ).toBe(total),
  );
  it.each([
    [0, 1],
    [31, 1],
    [1, 0],
    [2, Number.MAX_SAFE_INTEGER],
  ])('rejects unsafe duration/rate', (days, rate) =>
    expect(() =>
      bookingPrice(rate, new Date(0), new Date(days * DAY_MS)),
    ).toThrow(),
  );
});
