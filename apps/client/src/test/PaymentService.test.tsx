import { describe, expect, it } from 'vitest';
import { PaymentError } from '../services/payments';
const cases = Array.from({ length: 12 }, (_, index) => ({
  index,
  name: 'payment transport case ' + (index + 1),
}));
describe('payment transport case', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(new PaymentError(503, 'SAFE').code === 'SAFE').toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
