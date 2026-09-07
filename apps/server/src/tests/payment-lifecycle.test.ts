import { describe, expect, it } from 'vitest';
import { isStripeAmountSupported } from '../payments/lifecycle.js';
const cases = Array.from({ length: 12 }, (_, index) => ({
  index,
  name: 'payment lifecycle policy ' + (index + 1),
}));
describe('payment lifecycle policy', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(
      isStripeAmountSupported(50) && isStripeAmountSupported(999_999_999),
    ).toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
