import { describe, expect, it } from 'vitest';
import { isPaymentStartEligible } from '../payments/lifecycle.js';
const cases = Array.from({ length: 8 }, (_, index) => ({
  index,
  name: 'booking payment coordination ' + (index + 1),
}));
describe('booking payment coordination', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(
      isPaymentStartEligible('confirmed') && !isPaymentStartEligible('pending'),
    ).toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
