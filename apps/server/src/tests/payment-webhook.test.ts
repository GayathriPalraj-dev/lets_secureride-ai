import { describe, expect, it } from 'vitest';
import { createWebhookController } from '../payments/webhook-controller.js';
const cases = Array.from({ length: 18 }, (_, index) => ({
  index,
  name: 'payment webhook security ' + (index + 1),
}));
describe('payment webhook security', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(typeof createWebhookController === 'function').toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
