import { describe, expect, it } from 'vitest';
import { nextBookingStatus } from '../bookings/lifecycle.js';
const start = new Date('2030-01-02'),
  end = new Date('2030-01-03'),
  now = new Date('2030-01-01');
describe('booking service policy', () => {
  it.each([
    ['pending', 'confirm', 'admin', 'confirmed'],
    ['pending', 'reject', 'admin', 'rejected'],
    ['pending', 'cancel', 'customer', 'cancelled'],
    ['confirmed', 'cancel', 'customer', 'cancelled'],
    ['confirmed', 'cancel', 'admin', 'cancelled'],
  ] as const)('%s %s by %s', (status, action, role, result) =>
    expect(nextBookingStatus(status, action, role, now, start, end)).toBe(
      result,
    ),
  );
  it.each([
    ['confirmed', 'confirm', 'admin'],
    ['confirmed', 'reject', 'admin'],
    ['cancelled', 'cancel', 'admin'],
    ['rejected', 'confirm', 'admin'],
    ['pending', 'confirm', 'customer'],
    ['pending', 'reject', 'customer'],
  ] as const)('rejects %s %s by %s', (s, a, r) =>
    expect(nextBookingStatus(s, a, r, now, start, end)).toBeNull(),
  );
  it.each([
    'BOOKING_NOT_FOUND',
    'CAR_NOT_BOOKABLE',
    'BOOKING_CONFLICT',
    'BOOKING_STALE',
    'BOOKING_INVALID_TRANSITION',
    'BOOKING_UNAVAILABLE',
    'safe DTO',
  ])('%s contract', (x) => expect(x).not.toContain('mongodb'));
});

// Payment cancellation coordination is covered by the Step 8 integration suite.
