import { createHmac } from 'node:crypto';
import { ipKeyGenerator } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import type { AuthRepository } from '../auth/repository.js';
import { AppError } from '../utils/app-error.js';
export const authLimits = {
  register: { limit: 5, seconds: 3600 },
  login: { limit: 20, seconds: 900 },
  account: { limit: 10, seconds: 900 },
  refresh: { limit: 60, seconds: 300 },
  session: { limit: 30, seconds: 300 },
  logout: { limit: 30, seconds: 300 },
  logoutAll: { limit: 5, seconds: 900 },
  me: { limit: 60, seconds: 60 },
} as const;
export function createAuthLimiter(
  repo: AuthRepository,
  secret: string,
  now: () => Date = () => new Date(),
) {
  return (
    category: keyof typeof authLimits,
    key: 'ip' | 'account' | 'session' | 'user' = 'ip',
    sessionId?: (req: Parameters<RequestHandler>[0]) => string | undefined,
  ): RequestHandler => {
    return async (req, res, next) => {
      try {
        let identity: string;
        if (key === 'account') {
          const body = req.body as Record<string, unknown> | undefined;
          identity =
            typeof body?.email === 'string'
              ? body.email.trim().toLowerCase().slice(0, 320)
              : 'invalid';
        } else if (key === 'user') identity = req.auth?.userId ?? 'missing';
        else if (key === 'session')
          identity = req.auth?.sessionId ?? sessionId?.(req) ?? 'missing';
        else
          identity = ipKeyGenerator(
            req.ip || req.socket.remoteAddress || 'unknown',
          );
        const policy = authLimits[category];
        const time = now().getTime();
        const window = Math.floor(time / (policy.seconds * 1000));
        const digest = createHmac('sha256', Buffer.from(secret, 'base64'))
          .update(JSON.stringify([category, key, identity, window]))
          .digest('hex');
        const reset = new Date((window + 1) * policy.seconds * 1000);
        const count = await repo.hitLimit(
          digest,
          new Date(reset.getTime() + 60000),
        );
        if (count > policy.limit) {
          res.setHeader(
            'Retry-After',
            String(Math.max(1, Math.ceil((reset.getTime() - time) / 1000))),
          );
          throw new AppError(
            429,
            'RATE_LIMITED',
            'Too many requests; try again later',
          );
        }
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
  };
}
