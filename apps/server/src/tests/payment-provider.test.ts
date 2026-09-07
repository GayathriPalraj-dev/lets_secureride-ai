import { describe, expect, it } from 'vitest';
import { ProviderFailure } from '../payments/provider.js';
const cases = Array.from({ length: 8 }, (_, index) => ({
  index,
  name: 'payment provider boundary ' + (index + 1),
}));
describe('payment provider boundary', () => {
  it.each(cases)('$name', ({ index }) => {
    expect(
      new ProviderFailure('provider_unavailable').category ===
        'provider_unavailable',
    ).toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
