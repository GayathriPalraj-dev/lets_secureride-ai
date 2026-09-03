import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';
export function authCsrf(origin: string): RequestHandler {
  return (req, _res, next) => {
    if (req.method !== 'POST') {
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
    if (!req.is('application/json')) {
      next(
        new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON content is required'),
      );
      return;
    }
    next();
  };
}
