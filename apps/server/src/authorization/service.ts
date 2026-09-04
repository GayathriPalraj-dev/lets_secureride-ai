import type { Role } from '@lets-secureride-ai/contracts';
import type { AuthorizationEvents } from './events.js';
import type { RoleRepository, RoleTarget } from './repository.js';

export type RoleMode = 'check' | 'apply';
export type RoleResultStatus = 'ready' | 'changed' | 'already-set' | 'partial';
export interface RoleChangeResult {
  status: RoleResultStatus;
  currentRole: Role;
  targetRole: Role;
  revokedSessions: number;
}
export class RoleManagementError extends Error {
  constructor(public readonly code: string) {
    super('Role management could not be completed');
  }
}

export function createRoleService(
  repository: RoleRepository,
  events: AuthorizationEvents,
) {
  return {
    async execute(input: {
      mode: RoleMode;
      role: Role;
      target: RoleTarget;
      operationId: string;
    }): Promise<RoleChangeResult> {
      const matches = await repository.findTargets(input.target);
      if (!matches.length) throw new RoleManagementError('TARGET_NOT_FOUND');
      if (matches.length !== 1)
        throw new RoleManagementError('TARGET_AMBIGUOUS');
      const user = matches[0]!;
      if (user.status !== 'active')
        throw new RoleManagementError('TARGET_DISABLED');
      if (input.mode === 'check')
        return {
          status: user.role === input.role ? 'already-set' : 'ready',
          currentRole: user.role,
          targetRole: input.role,
          revokedSessions: 0,
        };
      if (user.role === input.role) {
        try {
          const revokedSessions = await repository.revokeStaleSessions(
            user.id,
            user.authVersion,
          );
          return {
            status: 'already-set',
            currentRole: user.role,
            targetRole: input.role,
            revokedSessions,
          };
        } catch {
          events({
            event: 'AUTH_ROLE_CHANGE_PARTIAL',
            outcome: 'failure',
            operationId: input.operationId,
            currentRole: user.role,
            targetRole: input.role,
          });
          return {
            status: 'partial',
            currentRole: user.role,
            targetRole: input.role,
            revokedSessions: 0,
          };
        }
      }
      const changed = await repository.changeRole(user, input.role);
      if (!changed) throw new RoleManagementError('CONCURRENT_CHANGE');
      try {
        const revokedSessions = await repository.revokeStaleSessions(
          changed.id,
          changed.authVersion,
        );
        events({
          event: 'AUTH_ROLE_CHANGED',
          outcome: 'success',
          operationId: input.operationId,
          currentRole: user.role,
          targetRole: changed.role,
        });
        return {
          status: 'changed',
          currentRole: user.role,
          targetRole: changed.role,
          revokedSessions,
        };
      } catch {
        events({
          event: 'AUTH_ROLE_CHANGE_PARTIAL',
          outcome: 'failure',
          operationId: input.operationId,
          currentRole: user.role,
          targetRole: changed.role,
        });
        return {
          status: 'partial',
          currentRole: user.role,
          targetRole: changed.role,
          revokedSessions: 0,
        };
      }
    },
  };
}
export type RoleService = ReturnType<typeof createRoleService>;
