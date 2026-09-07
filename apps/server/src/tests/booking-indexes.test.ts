import { describe, expect, it } from 'vitest';
import { expectedBookingIndexes } from '../bookings/indexes.js';
describe('booking indexes', () => {
  it.each([
    'booking_owner_created',
    'booking_admin_status_start',
    'booking_car_active_range',
  ])('declares booking index %s', (name) =>
    expect(expectedBookingIndexes.bookings.some((x) => x.name === name)).toBe(
      true,
    ),
  );
  it.each(['booking_occupancy_car_date_unique', 'booking_occupancy_booking'])(
    'declares occupancy index %s',
    (name) =>
      expect(
        expectedBookingIndexes.occupancies.some((x) => x.name === name),
      ).toBe(true),
  );
  it('sets only the car/date occupancy index unique', () =>
    expect(expectedBookingIndexes.occupancies[0].unique).toBe(true));
  it.each(expectedBookingIndexes.bookings)('keeps $name nonunique', (index) =>
    expect('unique' in index).toBe(false),
  );
  it('uses five explicit indexes', () =>
    expect(
      expectedBookingIndexes.bookings.length +
        expectedBookingIndexes.occupancies.length,
    ).toBe(5));
});
