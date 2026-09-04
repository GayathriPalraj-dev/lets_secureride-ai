import type { Role } from '@lets-secureride-ai/contracts';

export type AuthorizationEventName =
  'AUTHORIZATION_DENIED' | 'AUTH_ROLE_CHANGED' | 'AUTH_ROLE_CHANGE_PARTIAL';

export interface AuthorizationEventData {
  event: AuthorizationEventName;
  outcome: 'success' | 'failure';
  requestId?: string;
  operationId?: string;
  currentRole?: Role;
  targetRole?: Role;
}

export type AuthorizationEvents = (data: AuthorizationEventData) => void;

export function createAuthorizationEvents(
  write: (data: AuthorizationEventData & { timestamp: string }) => void,
): AuthorizationEvents {
  return (data) => {
    const safe = {
      event: data.event,
      outcome: data.outcome,
      ...(data.requestId ? { requestId: data.requestId } : {}),
      ...(data.operationId ? { operationId: data.operationId } : {}),
      ...(data.currentRole ? { currentRole: data.currentRole } : {}),
      ...(data.targetRole ? { targetRole: data.targetRole } : {}),
      timestamp: new Date().toISOString(),
    };
    try {
      write(safe);
    } catch {
      /* Authorization must not depend on logging availability. */
    }
  };
}
