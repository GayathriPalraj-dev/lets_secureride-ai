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
