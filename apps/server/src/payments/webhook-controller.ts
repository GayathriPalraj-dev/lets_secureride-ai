import type { RequestHandler } from 'express';
import type { PaymentProvider } from './provider.js';
import type { PaymentEvents } from './events.js';
import type { createWebhookService } from './webhook-service.js';
export function createWebhookController(
  provider: PaymentProvider,
  service: ReturnType<typeof createWebhookService>,
  signingSecret: string,
  invalidLimiter: RequestHandler,
  events: PaymentEvents,
): RequestHandler {
  return (request, response, next) => {
    const reject = () =>
      invalidLimiter(request, response, (error?: unknown) => {
        if (error) {
          next(error);
          return;
        }
        events({
          event: 'PAYMENT_WEBHOOK_REJECTED',
          outcome: 'failure',
          operation: 'webhook',
        });
        response.status(400).json({
          success: false,
          error: {
            code: 'INVALID_WEBHOOK',
            message: 'Webhook could not be verified',
          },
          requestId: request.requestId,
        });
      });
    const signature = request.headers['stripe-signature'];
    if (
      !Buffer.isBuffer(request.body) ||
      typeof signature !== 'string' ||
      signature.length < 8 ||
      signature.length > 1024
    ) {
      reject();
      return;
    }
    let event;
    try {
      event = provider.constructWebhookEvent(
        request.body,
        signature,
        signingSecret,
        300,
      );
    } catch {
      reject();
      return;
    }
    void service
      .process(event)
      .then(() => response.status(200).json({ received: true }))
      .catch(next);
  };
}
