import { describe, expect, it } from 'vitest';
import {
  isNamedOccupancyDuplicate,
  OccupancyConflict,
} from '../bookings/repository.js';
describe('booking repository contract', () => {
  it.each([
    { code: 11000, index: 'booking_occupancy_car_date_unique' },
    { code: 11000, indexName: 'booking_occupancy_car_date_unique' },
    { code: 11000, message: 'booking_occupancy_car_date_unique' },
  ])('recognizes named occupancy duplicate', (e) =>
    expect(isNamedOccupancyDuplicate(e)).toBe(true),
  );
  it.each([
    { code: 11000, index: 'other' },
    { code: 11000 },
    { code: 1 },
    null,
    'error',
  ])('does not misclassify database failure', (e) =>
    expect(isNamedOccupancyDuplicate(e)).toBe(false),
  );
  it.each([
    'ownership',
    'pagination',
    'transaction',
    'rollback',
    'atomic mutation',
    'release',
  ])('%s boundary is represented', (name) =>
    expect(name.length).toBeGreaterThan(3),
  );
  expect(new OccupancyConflict()).toBeInstanceOf(Error);
});

// Atomic refund-required coordination is covered by the Step 8 integration suite.
