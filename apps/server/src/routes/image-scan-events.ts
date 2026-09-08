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
    express.raw({ type: 'application/json', limit: '32kb' }),
    createScanController(d.service, d.secret),
  );
  return router;
}
