import type { RequestHandler } from 'express';
import type { AuthService } from '../auth/service.js';
import { unauthorized } from '../auth/token-service.js';
import { AppError } from '../utils/app-error.js';
export function authenticate(service: AuthService): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header || !/^Bearer [A-Za-z0-9_.-]+$/.test(header))
        throw unauthorized();
      req.auth = await service.authenticate(header.slice(7));
      next();
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError(
              503,
              'AUTH_UNAVAILABLE',
              'Authentication is temporarily unavailable',
            ),
      );
    }
  };
}
