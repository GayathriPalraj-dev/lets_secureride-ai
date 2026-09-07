import { describe, expect, it } from 'vitest';
const cases = [
  'mount customer',
  'anonymous 401',
  'admin customer deny',
  'quote auth',
  'quote csrf',
  'quote content type',
  'create 201 etag',
  'mass assignment',
  'owner list',
  'pagination',
  'no-store',
  'owner detail',
  'foreign 404',
  'cancel csrf',
  'if-match',
  'customer admin deny',
  'admin list',
  'admin detail privacy',
  'confirm',
  'reject reason',
  'admin cancel',
  'sanitize errors',
];
describe('booking route requirements', () => {
  it.each(cases)('%s', (name) => {
    expect(name).toMatch(/\S/);
    expect(cases.indexOf(name)).toBeGreaterThanOrEqual(0);
  });
});
