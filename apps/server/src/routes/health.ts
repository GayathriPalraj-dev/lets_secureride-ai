import { Router } from 'express';
import type { HealthResponse } from '@lets-secureride-ai/contracts';
import type { Config } from '../config/env.js';

export function healthRouter(config: Config) {
  const router = Router();
  router.get('/health', (req, res) => {
    const body: HealthResponse = {
      success: true,
      data: {
        service: 'lets-secureride-ai-api',
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptimeSeconds: process.uptime(),
        environment: config.NODE_ENV,
      },
      requestId: req.requestId,
    };
    res.json(body);
  });
  return router;
}
