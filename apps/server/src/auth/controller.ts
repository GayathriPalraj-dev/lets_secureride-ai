import type { Request, RequestHandler, Response } from 'express';
import type { AuthService } from './service.js';
import type { AuthCookies } from './cookies.js';
import type { AuthEvents } from './events.js';
import {
  validate,
  registerSchema,
  loginSchema,
  emptySchema,
} from './validation.js';
import { AppError } from '../utils/app-error.js';
import { unauthorized } from './token-service.js';
export function createAuthController(
  service: AuthService,
  cookies: AuthCookies,
  events: AuthEvents,
) {
  const wrap =
    (
      operation: (req: Request, res: Response) => Promise<void>,
    ): RequestHandler =>
    async (req, res, next) => {
      try {
        await operation(req, res);
      } catch (error) {
        if (error instanceof AppError) {
          next(error);
          return;
        }
        events({
          event: 'AUTH_OPERATION_FAILED',
          requestId: req.requestId,
          outcome: 'failure',
        });
        next(
          new AppError(
            503,
            'AUTH_UNAVAILABLE',
            'Authentication is temporarily unavailable',
          ),
        );
      }
    };
  const success = (
    req: Request,
    res: Response,
    data: unknown,
    status = 200,
  ) => {
    res.status(status).json({ success: true, data, requestId: req.requestId });
  };
  return {
    register: wrap(async (req, res) => {
      const body = validate(registerSchema, req.body);
      success(
        req,
        res,
        await service.register(body.email, body.password, req.requestId),
        201,
      );
    }),
    login: wrap(async (req, res) => {
      const body = validate(loginSchema, req.body);
      const result = await service.login(
        body.email,
        body.password,
        req.requestId,
      );
      cookies.set(res, result.refreshToken, result.expiresAt, new Date());
      success(req, res, result.data);
    }),
    refresh: wrap(async (req, res) => {
      validate(emptySchema, req.body);
      try {
        const result = await service.refresh(cookies.read(req), req.requestId);
        cookies.set(res, result.refreshToken, result.expiresAt, new Date());
        success(req, res, result.data);
      } catch (error) {
        if (error instanceof AppError && error.status === 401)
          cookies.clear(res);
        throw error;
      }
    }),
    logout: wrap(async (req, res) => {
      validate(emptySchema, req.body);
      let raw: string | undefined;
      try {
        raw = cookies.read(req);
      } catch {
        raw = undefined;
      }
      let data;
      try {
        data = await service.logout(raw, req.requestId);
      } catch (error) {
        cookies.clear(res);
        throw error;
      }
      cookies.clear(res);
      success(req, res, data);
    }),
    logoutAll: wrap(async (req, res) => {
      validate(emptySchema, req.body);
      if (!req.auth) throw unauthorized();
      const data = await service.logoutAll(req.auth, req.requestId);
      cookies.clear(res);
      success(req, res, data);
    }),
    me: wrap(async (req, res) => {
      if (!req.auth) throw unauthorized();
      success(req, res, await service.me(req.auth));
    }),
  };
}
