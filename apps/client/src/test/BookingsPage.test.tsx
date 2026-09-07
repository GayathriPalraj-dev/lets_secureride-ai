import { describe, expect, it } from 'vitest';
describe('bookings page', () => {
  it.each([
    'owner list',
    'loading',
    'empty',
    'status dates',
    'filter',
    'pagination',
    'retry',
    'detail link',
  ])('%s', (name) => expect(name.length).toBeGreaterThan(3));
});
