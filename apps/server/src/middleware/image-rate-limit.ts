import { createHmac } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { AuthRepository } from '../auth/repository.js';
import { AppError } from '../utils/app-error.js';
const limits = {
  upload: [10, 900],
  complete: [20, 900],
  manage: [60, 300],
  read: [120, 60],
  event: [120, 60],
} as const;
export function createImageLimiter(
  repository: Pick<AuthRepository, 'hitLimit'>,
  secret: string,
  now = () => new Date(),
) {
  return (category: keyof typeof limits): RequestHandler =>
    async (req, _res, next) => {
      try {
        const [limit, seconds] = limits[category],
          t = now().getTime(),
          window = Math.floor(t / (seconds * 1000)),
          identity = req.auth?.userId ?? req.ip ?? 'missing',
          key = createHmac('sha256', Buffer.from(secret, 'base64'))
            .update(JSON.stringify(['image', category, identity, window]))
            .digest('hex');
        if (
          (await repository.hitLimit(
            key,
            new Date((window + 1) * seconds * 1000 + 60000),
          )) > limit
        )
          throw new AppError(
            429,
            'RATE_LIMITED',
            'Too many requests; try again later',
          );
        next();
      } catch (e) {
        next(
          e instanceof AppError
            ? e
            : new AppError(
                503,
                'CAR_IMAGE_STORAGE_UNAVAILABLE',
                'Image service is temporarily unavailable',
              ),
        );
      }
    };
}
