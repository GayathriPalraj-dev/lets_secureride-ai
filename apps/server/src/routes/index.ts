import { Router } from 'express';
import type { Config } from '../config/env.js';
import { healthRouter } from './health.js';
import { readinessRouter } from './readiness.js';
export function apiRouter(config: Config, isReady: () => boolean) {
  const router = Router();
  router.use(healthRouter(config));
  router.use(readinessRouter(isReady));
  return router;
}
