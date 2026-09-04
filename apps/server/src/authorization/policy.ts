import type { Role } from '@lets-secureride-ai/contracts';

export const AUTH_ROLES = [
  'customer',
  'admin',
] as const satisfies readonly Role[];

export function isRole(value: unknown): value is Role {
  return value === 'customer' || value === 'admin';
}

export function roleAllowed(actual: Role, allowed: readonly Role[]): boolean {
  return allowed.length > 0 && isRole(actual) && allowed.includes(actual);
}
