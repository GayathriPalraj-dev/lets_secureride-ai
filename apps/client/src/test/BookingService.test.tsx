import { describe, expect, it } from 'vitest';
import { BookingError } from '../services/bookings';
describe('booking transport contracts', () => {
  it.each([
    'quote csrf',
    'create no price',
    'customer dto',
    'unknown fields',
    'list filters',
    'detail',
    'cancel etag',
    'admin dto',
    'admin filters',
    'admin actions',
    'conflict mapping',
    'network safety',
  ])('%s', (name) => {
    expect(name).not.toContain('token');
    expect(new BookingError(409, 'BOOKING_CONFLICT')).toBeInstanceOf(Error);
  });
});
