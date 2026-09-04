import type { RequestHandler } from 'express';
import type { Role } from '@lets-secureride-ai/contracts';
import type { AuthorizationEvents } from '../authorization/events.js';
import { isRole, roleAllowed } from '../authorization/policy.js';
import { unauthorized } from '../auth/token-service.js';
import { AppError } from '../utils/app-error.js';

export function requireRole(
  role: Role,
  events?: AuthorizationEvents,
): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(unauthorized());
      return;
    }
    const actual: unknown = req.auth.role;
    if (!isRole(actual) || !roleAllowed(actual, [role])) {
      events?.({
        event: 'AUTHORIZATION_DENIED',
        outcome: 'failure',
        requestId: req.requestId,
        ...(isRole(actual) ? { currentRole: actual } : {}),
      });
      next(
        new AppError(
          403,
          'FORBIDDEN',
          'You do not have permission to perform this action',
        ),
      );
      return;
    }
    next();
  };
}
