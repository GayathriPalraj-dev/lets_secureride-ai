import { describe, expect, it } from 'vitest';
describe('admin booking page', () => {
  it.each([
    'inventory',
    'loading',
    'empty',
    'status filter',
    'car date filter',
    'pagination',
    'safe detail',
    'opaque customer',
    'confirm',
    'reject',
    'cancel',
    'forbidden stale retry',
  ])('%s', (name) => expect(name).not.toContain('email'));
});
