import express, { Router, type RequestHandler } from 'express';
import type { ScanService } from '../car-images/scan-service.js';
import { createScanController } from '../car-images/scan-controller.js';
export function imageScanEventsRouter(d: {
  service: ScanService;
  secret: string;
  limiter: RequestHandler;
}) {
  const router = Router();
  router.post(
    '/api/v1/internal/car-image-events',
    d.limiter,
    (request, response, next) => {
      if (request.headers['content-encoding']) {
        response.status(415).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_ENCODING',
            message: 'Compressed signed requests are not accepted',
          },
          requestId: request.requestId,
        });
        return;
      }
      next();
    },
    express.raw({ type: 'application/json', limit: '32kb' }),
    createScanController(d.service, d.secret),
  );
  return router;
}
