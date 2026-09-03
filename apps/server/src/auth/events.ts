export type AuthEvent =
  | 'AUTH_REGISTERED'
  | 'AUTH_LOGIN_SUCCEEDED'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_REFRESH_REUSE'
  | 'AUTH_LOGOUT'
  | 'AUTH_LOGOUT_ALL'
  | 'AUTH_OPERATION_FAILED';
export interface AuthEventData {
  event: AuthEvent;
  requestId: string;
  outcome: 'success' | 'failure';
  userId?: string;
}
export type AuthEvents = (data: AuthEventData) => void;
export function createAuthEvents(
  write: (data: AuthEventData & { timestamp: string }) => void,
): AuthEvents {
  return (data) => {
    const safe = {
      event: data.event,
      requestId: data.requestId,
      outcome: data.outcome,
      ...(data.userId ? { userId: data.userId } : {}),
      timestamp: new Date().toISOString(),
    };
    try {
      write(safe);
    } catch {
      /* Logging failure must not expose input or undo revocation. */
    }
  };
}
