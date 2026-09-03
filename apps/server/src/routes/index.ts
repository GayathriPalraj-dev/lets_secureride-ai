import { Router } from 'express';
import type { Config } from '../config/env.js';
import { healthRouter } from './health.js';
import { readinessRouter } from './readiness.js';
import { authRouter, type AuthDependencies } from './auth.js';
export function apiRouter(
  config: Config,
  isReady: () => boolean,
  auth?: AuthDependencies,
) {
  const router = Router();
  router.use(healthRouter(config));
  router.use(readinessRouter(isReady));
  if (auth) router.use('/auth', authRouter(auth));
  return router;
}
