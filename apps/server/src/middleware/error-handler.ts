import type { ErrorRequestHandler } from 'express';
import type { ApiError } from '@lets-secureride-ai/contracts';
import { AppError } from '../utils/app-error.js';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  if (error instanceof AppError) {
    status = error.status;
    code = error.code;
    message = error.publicMessage;
  } else if (typeof error === 'object' && error !== null && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      status = 400;
      code = 'INVALID_JSON';
      message = 'Request body must contain valid JSON';
    } else if (error.type === 'entity.too.large') {
      status = 413;
      code = 'BODY_TOO_LARGE';
      message = 'Request body exceeds the size limit';
    }
  }
  // Deliberately exclude raw errors, paths, headers, and bodies.
  req.log?.error({ requestId: req.requestId, status, code }, 'Request failed');
  const body: ApiError = {
    success: false,
    error: { code, message },
    requestId: req.requestId,
  };
  res.status(status).json(body);
};
