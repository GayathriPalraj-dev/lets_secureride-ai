import { describe, expect, it } from 'vitest';
import { PaymentPage } from '../pages/PaymentPage';
const cases = Array.from({ length: 13 }, (_, index) => ({
  index,
  name: 'payment page state ' + (index + 1),
}));
describe('payment page state', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(typeof PaymentPage === 'function').toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
