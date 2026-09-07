import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';
export function authCsrf(origin: string): RequestHandler {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      next();
      return;
    }
    if (
      req.headers.origin !== origin ||
      req.headers['x-csrf-protection'] !== '1' ||
      (req.headers['sec-fetch-site'] !== undefined &&
        !['same-origin', 'same-site'].includes(
          String(req.headers['sec-fetch-site']),
        ))
    ) {
      next(
        new AppError(
          403,
          'CSRF_REJECTED',
          'Request origin could not be verified',
        ),
      );
      return;
    }
    if (req.method !== 'DELETE' && !req.is('application/json')) {
      next(
        new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON content is required'),
      );
      return;
    }
    next();
  };
}
