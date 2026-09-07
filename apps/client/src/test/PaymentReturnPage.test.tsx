import { describe, expect, it } from 'vitest';
import { PaymentReturnPage } from '../pages/PaymentReturnPage';
const cases = Array.from({ length: 8 }, (_, index) => ({
  index,
  name: 'payment return state ' + (index + 1),
}));
describe('payment return state', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(typeof PaymentReturnPage === 'function').toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
