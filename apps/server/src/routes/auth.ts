import { Router } from 'express';
import type { AuthService } from '../auth/service.js';
import type { AuthRepository } from '../auth/repository.js';
import type { TokenService } from '../auth/token-service.js';
import type { AuthConfig } from '../config/auth.js';
import type { AuthEvents } from '../auth/events.js';
import { createAuthController } from '../auth/controller.js';
import { createAuthCookies } from '../auth/cookies.js';
import { authenticate } from '../middleware/authenticate.js';
import { authCsrf } from '../middleware/auth-csrf.js';
import { createAuthLimiter } from '../middleware/auth-rate-limit.js';
export interface AuthDependencies {
  service: AuthService;
  repo: AuthRepository;
  tokens: TokenService;
  config: AuthConfig;
  events: AuthEvents;
  production: boolean;
  origin: string;
}
export function authRouter(deps: AuthDependencies) {
  const router = Router();
  const cookies = createAuthCookies(deps.production);
  const controller = createAuthController(deps.service, cookies, deps.events);
  const limit = createAuthLimiter(
    deps.repo,
    deps.config.AUTH_RATE_LIMIT_SECRET,
  );
  const required = authenticate(deps.service);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(authCsrf(deps.origin));
  router.post('/register', limit('register'), controller.register);
  router.post(
    '/login',
    limit('login'),
    limit('account', 'account'),
    controller.login,
  );
  router.post(
    '/refresh',
    limit('refresh'),
    limit('session', 'session', (req) => {
      const raw = cookies.read(req);
      return raw ? deps.tokens.parseRefresh(raw)?.id : undefined;
    }),
    controller.refresh,
  );
  router.post('/logout', limit('logout'), controller.logout);
  router.post(
    '/logout-all',
    required,
    limit('logoutAll', 'user'),
    controller.logoutAll,
  );
  router.get('/me', required, limit('me', 'session'), controller.me);
  return router;
}
