import { Router } from 'express';
import type { ReadinessResponse } from '@lets-secureride-ai/contracts';

export function readinessRouter(isReady: () => boolean) {
  const router = Router();
  router.get('/health/ready', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    let ready = false;
    try {
      ready = isReady();
    } catch {
      /* Fail closed without exposing adapter exceptions. */
    }
    const body: ReadinessResponse = ready
      ? {
          success: true,
          data: {
            service: 'lets-secureride-ai-api',
            status: 'ready',
            database: 'connected',
            timestamp: new Date().toISOString(),
          },
          requestId: req.requestId,
        }
      : {
          success: false,
          error: {
            code: 'SERVICE_NOT_READY',
            message: 'Service is temporarily unavailable',
          },
          requestId: req.requestId,
        };
    res.status(ready ? 200 : 503).json(body);
  });
  return router;
}
