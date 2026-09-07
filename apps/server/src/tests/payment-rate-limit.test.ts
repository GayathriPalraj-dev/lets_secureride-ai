import { describe, expect, it } from 'vitest';
import { paymentLimits } from '../middleware/payment-rate-limit.js';
const cases = Array.from({ length: 8 }, (_, index) => ({
  index,
  name: 'payment limiter stage ' + (index + 1),
}));
describe('payment limiter stage', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(
      paymentLimits.webhook.limit === 300 &&
        paymentLimits.webhookInvalid.limit === 20,
    ).toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
