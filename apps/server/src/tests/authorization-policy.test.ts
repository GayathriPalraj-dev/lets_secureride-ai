import { describe, expect, it } from 'vitest';
import { AUTH_ROLES, isRole, roleAllowed } from '../authorization/policy.js';

describe('authorization policy', () => {
  it('recognizes customer', () => expect(isRole('customer')).toBe(true));
  it('recognizes admin', () => expect(isRole('admin')).toBe(true));
  it('rejects undefined', () => expect(isRole(undefined)).toBe(false));
  it('rejects unknown strings', () => expect(isRole('owner')).toBe(false));
  it('rejects malformed values', () => {
    for (const value of [null, 1, {}, []]) expect(isRole(value)).toBe(false);
  });
  it('permits an allowed role', () =>
    expect(roleAllowed('admin', ['admin'])).toBe(true));
  it('denies a disallowed role', () =>
    expect(roleAllowed('customer', ['admin'])).toBe(false));
  it('keeps empty policy fail closed', () => {
    expect(roleAllowed('admin', [])).toBe(false);
    expect(AUTH_ROLES).toEqual(['customer', 'admin']);
  });
});
