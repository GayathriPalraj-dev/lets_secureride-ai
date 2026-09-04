import type { AuthUser, Role } from '@lets-secureride-ai/contracts';
export interface IdentityRecord {
  id: string;
  email: string;
  role: Role;
}
export function toAuthUser(user: IdentityRecord): AuthUser {
  return { id: user.id, email: user.email, role: user.role };
}
