import express, { Router, type RequestHandler } from 'express';
import type { PaymentProvider } from '../payments/provider.js';
import type { PaymentEvents } from '../payments/events.js';
import type { createWebhookService } from '../payments/webhook-service.js';
import { createWebhookController } from '../payments/webhook-controller.js';
export function paymentWebhookRouter(d: {
  provider: PaymentProvider;
  service: ReturnType<typeof createWebhookService>;
  signingSecret: string;
  coarseLimiter: RequestHandler;
  invalidLimiter: RequestHandler;
  events: PaymentEvents;
}) {
  const router = Router();
  router.post(
    '/',
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
    express.raw({ type: 'application/json', limit: '64kb' }),
    d.coarseLimiter,
    createWebhookController(
      d.provider,
      d.service,
      d.signingSecret,
      d.invalidLimiter,
      d.events,
    ),
  );
  return router;
}
