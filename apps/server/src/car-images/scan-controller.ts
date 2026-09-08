import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { ScanService } from './scan-service.js';
import { scanEventSchema } from './validation.js';
import { AppError } from '../utils/app-error.js';

function validSignature(
  raw: Buffer,
  supplied: string | undefined,
  secret: string,
) {
  if (!supplied || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const actual = Buffer.from(supplied, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function createScanController(
  service: ScanService,
  secret: string,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const raw = req.body;
      if (
        !Buffer.isBuffer(raw) ||
        !validSignature(raw, req.header('x-car-image-signature'), secret)
      )
        throw new AppError(
          401,
          'INVALID_IMAGE_EVENT',
          'Event could not be authenticated',
        );
      let json: unknown;
      try {
        json = JSON.parse(raw.toString('utf8'));
      } catch {
        throw new AppError(400, 'INVALID_IMAGE_EVENT', 'Event was invalid');
      }
      const result = scanEventSchema.safeParse(json);
      if (!result.success)
        throw new AppError(400, 'INVALID_IMAGE_EVENT', 'Event was invalid');
      await service.process(
        { ...result.data, eventTime: new Date(result.data.eventTime) },
        req.requestId,
      );
      res.status(202).json({
        success: true,
        data: { accepted: true },
        requestId: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  };
}
