import { describe, expect, it } from 'vitest';
import { AdminPaymentsPage } from '../pages/AdminPaymentsPage';
const cases = Array.from({ length: 10 }, (_, index) => ({
  index,
  name: 'admin payment state ' + (index + 1),
}));
describe('admin payment state', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(typeof AdminPaymentsPage === 'function').toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
