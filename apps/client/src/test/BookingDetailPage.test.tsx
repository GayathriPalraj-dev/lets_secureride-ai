import { describe, expect, it } from 'vitest';
describe('booking detail page', () => {
  it.each([
    'owned detail',
    'price snapshot',
    'uniform unavailable',
    'cancel confirmation',
    'revision',
    'stale reload',
  ])('%s', (name) => expect(name).not.toContain('secret'));
});
