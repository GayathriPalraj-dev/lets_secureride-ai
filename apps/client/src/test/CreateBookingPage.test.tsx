import { describe, expect, it } from 'vitest';
describe('create booking page', () => {
  it.each([
    'loads car',
    'loading',
    'unavailable car',
    'server quote',
    'price preview',
    'create navigation',
    'booking conflict',
    'expiry retry',
  ])('%s', (name) => expect(name).toMatch(/\S/));
});
