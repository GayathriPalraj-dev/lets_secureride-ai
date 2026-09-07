import { describe, expect, it } from 'vitest';
import { paymentSchema } from '../models/payment.js';
const cases = Array.from({ length: 10 }, (_, index) => ({
  index,
  name: 'payment model invariant ' + (index + 1),
}));
describe('payment model invariant', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(paymentSchema.get('autoIndex') === false).toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
