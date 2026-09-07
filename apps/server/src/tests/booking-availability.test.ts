import { describe, expect, it, vi } from 'vitest';
import {
  occupancyDates,
  createAvailability,
} from '../bookings/availability.js';
import { DAY_MS } from '../bookings/pricing.js';
describe('availability', () => {
  it.each([1, 2, 3, 4])('expands %i exclusive days', (n) =>
    expect(occupancyDates(new Date(0), new Date(n * DAY_MS))).toHaveLength(n),
  );
  it.each([0, 31])('rejects %i days', (n) =>
    expect(() => occupancyDates(new Date(0), new Date(n * DAY_MS))).toThrow(),
  );
  it.each([false, true])('reports occupied=%s', async (occupied) => {
    const a = createAvailability({
      hasOccupancy: vi.fn(async () => occupied),
      hasBlockingBooking: vi.fn(async () => occupied),
    });
    expect(await a.available('a', new Date(0), new Date(DAY_MS))).toBe(
      !occupied,
    );
  });
  it.each([false, true])('reports blocking=%s', async (blocked) => {
    const a = createAvailability({
      hasOccupancy: vi.fn(),
      hasBlockingBooking: vi.fn(async () => blocked),
    });
    expect(await a.hasBlockingBooking('a', new Date())).toBe(blocked);
  });
});
