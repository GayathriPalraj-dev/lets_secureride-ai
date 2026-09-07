import { createHmac } from 'node:crypto';
import { ipKeyGenerator } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import type { AuthRepository } from '../auth/repository.js';
import { AppError } from '../utils/app-error.js';
export const paymentLimits = {
  start: { limit: 10, seconds: 900 },
  status: { limit: 60, seconds: 60 },
  history: { limit: 30, seconds: 300 },
  admin: { limit: 60, seconds: 300 },
  reconcile: { limit: 10, seconds: 900 },
  refund: { limit: 5, seconds: 3600 },
  webhook: { limit: 300, seconds: 60 },
  webhookInvalid: { limit: 20, seconds: 300 },
} as const;
export function createPaymentLimiter(
  repository: Pick<AuthRepository, 'hitLimit'>,
  secret: string,
  now = () => new Date(),
) {
  return (
      category: keyof typeof paymentLimits,
      identity: 'ip' | 'user' = 'user',
    ): RequestHandler =>
    async (request, response, next) => {
      try {
        const policy = paymentLimits[category];
        const time = now().getTime();
        const window = Math.floor(time / (policy.seconds * 1000));
        const value =
          identity === 'ip'
            ? ipKeyGenerator(
                request.ip || request.socket.remoteAddress || 'unknown',
              )
            : (request.auth?.userId ?? 'missing');
        const digest = createHmac('sha256', Buffer.from(secret, 'base64'))
          .update(JSON.stringify(['payment', category, value, window]))
          .digest('hex');
        const reset = new Date((window + 1) * policy.seconds * 1000);
        const count = await repository.hitLimit(
          digest,
          new Date(reset.getTime() + 60_000),
        );
        if (count > policy.limit) {
          response.setHeader(
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
                'PAYMENT_PROVIDER_UNAVAILABLE',
                'Payment service is temporarily unavailable',
              ),
        );
      }
    };
}
