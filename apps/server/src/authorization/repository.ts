import type { Role } from '@lets-secureride-ai/contracts';
import type { AuthModels } from '../auth/repository.js';

export interface RoleTarget {
  kind: 'id' | 'email';
  value: string;
}
export interface RoleUser {
  id: string;
  role: Role;
  status: 'active' | 'disabled';
  authVersion: number;
}
export interface RoleRepository {
  findTargets(target: RoleTarget): Promise<RoleUser[]>;
  changeRole(user: RoleUser, targetRole: Role): Promise<RoleUser | null>;
  revokeStaleSessions(userId: string, authVersion: number): Promise<number>;
}

export function createRoleRepository(models: AuthModels): RoleRepository {
  const map = (row: {
    _id: { toString(): string };
    role: string;
    status: string;
    authVersion: number;
  }): RoleUser => {
    if (
      (row.role !== 'customer' && row.role !== 'admin') ||
      (row.status !== 'active' && row.status !== 'disabled')
    )
      throw new Error('Invalid account state');
    return {
      id: row._id.toString(),
      role: row.role,
      status: row.status,
      authVersion: row.authVersion,
    };
  };
  return {
    async findTargets(target) {
      const filter =
        target.kind === 'id' ? { _id: target.value } : { email: target.value };
      const rows = await models.users
        .find(filter)
        .select('+authVersion')
        .limit(2)
        .lean();
      return rows.map(map);
    },
    async changeRole(user, targetRole) {
      const row = await models.users
        .findOneAndUpdate(
          {
            _id: user.id,
            role: user.role,
            status: 'active',
            authVersion: user.authVersion,
          },
          { $set: { role: targetRole }, $inc: { authVersion: 1 } },
          { new: true },
        )
        .select('+authVersion')
        .lean();
      return row ? map(row) : null;
    },
    async revokeStaleSessions(userId, authVersion) {
      const result = await models.sessions.updateMany(
        { userId, authVersion: { $lt: authVersion }, revokedAt: null },
        { $set: { revokedAt: new Date(), revokeReason: 'logout-all' } },
      );
      return result.modifiedCount;
    },
  };
}
