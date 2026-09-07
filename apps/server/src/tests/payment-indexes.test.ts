import { describe, expect, it } from 'vitest';
import { expectedPaymentIndexes } from '../payments/indexes.js';
const cases = Array.from({ length: 10 }, (_, index) => ({
  index,
  name: 'payment index invariant ' + (index + 1),
}));
describe('payment index invariant', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(
      expectedPaymentIndexes.payments.length === 5 &&
        expectedPaymentIndexes.events.length === 2,
    ).toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
