import { Router } from 'express';
import type { Config } from '../config/env.js';
import { healthRouter } from './health.js';
export function apiRouter(config: Config) {
  const router = Router();
  router.use(healthRouter(config));
  return router;
}
