import type {
  PaymentStatus,
  RefundStatus,
} from '@lets-secureride-ai/contracts';
import { supportedPaymentEvents } from '../models/payment-event.js';
import type { PaymentEvents } from './events.js';
import type { PaymentRepository } from './repository.js';
import type { ProviderEvent } from './types.js';
const paymentStatus = (event: ProviderEvent): PaymentStatus | undefined =>
  event.type === 'payment_intent.succeeded'
    ? 'succeeded'
    : event.type === 'payment_intent.processing'
      ? 'processing'
      : event.type === 'payment_intent.payment_failed'
        ? 'requires_payment_method'
        : event.type === 'payment_intent.canceled'
          ? 'canceled'
          : undefined;
const refundStatus = (event: ProviderEvent): RefundStatus | undefined =>
  event.type === 'refund.failed'
    ? 'failed'
    : event.type === 'refund.created'
      ? 'pending'
      : event.type === 'refund.updated'
        ? event.status === 'succeeded'
          ? 'succeeded'
          : event.status === 'failed'
            ? 'failed'
            : 'pending'
        : undefined;
export const createWebhookService = (
  repository: PaymentRepository,
  events: PaymentEvents,
) => ({
  async process(event: ProviderEvent) {
    if (!(supportedPaymentEvents as readonly string[]).includes(event.type))
      return 'ignored' as const;
    const result = await repository.applyEvent(
      event,
      paymentStatus(event),
      refundStatus(event),
    );
    if (result === 'duplicate')
      events({
        event: 'PAYMENT_WEBHOOK_DUPLICATE',
        outcome: 'ignored',
        operation: 'webhook',
      });
    return result;
  },
});
