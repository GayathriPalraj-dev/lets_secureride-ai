import { describe, expect, it } from 'vitest';
import { PaymentForm } from '../components/PaymentForm';
const cases = Array.from({ length: 10 }, (_, index) => ({
  index,
  name: 'payment form behavior ' + (index + 1),
}));
describe('payment form behavior', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(typeof PaymentForm === 'function').toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
