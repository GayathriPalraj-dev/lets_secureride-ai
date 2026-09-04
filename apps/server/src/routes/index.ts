import { Router } from 'express';
import type { Config } from '../config/env.js';
import { healthRouter } from './health.js';
import { readinessRouter } from './readiness.js';
import { authRouter, type AuthDependencies } from './auth.js';
import { adminRouter } from './admin.js';
import type { AuthorizationEvents } from '../authorization/events.js';
export interface ApiDependencies {
  auth: AuthDependencies;
  authorizationEvents: AuthorizationEvents;
}
export function apiRouter(
  config: Config,
  isReady: () => boolean,
  dependencies?: ApiDependencies,
) {
  const router = Router();
  router.use(healthRouter(config));
  router.use(readinessRouter(isReady));
  if (dependencies) {
    router.use('/auth', authRouter(dependencies.auth));
    router.use(
      '/admin',
      adminRouter({
        service: dependencies.auth.service,
        events: dependencies.authorizationEvents,
      }),
    );
  }
  return router;
}
