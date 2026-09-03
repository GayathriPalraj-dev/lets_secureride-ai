import type { AuthUser } from '@lets-secureride-ai/contracts';
export interface IdentityRecord {
  id: string;
  email: string;
  role: 'customer' | 'admin';
}
export function toAuthUser(user: IdentityRecord): AuthUser {
  return { id: user.id, email: user.email, role: user.role };
}
