import Stripe from 'stripe';
import type { PaymentProvider } from './provider.js';
import { ProviderFailure } from './provider.js';
import type {
  ProviderEvent,
  ProviderPaymentIntent,
  ProviderRefund,
  ProviderStatus,
} from './types.js';
const normalizeStatus = (value: Stripe.PaymentIntent.Status): ProviderStatus =>
  value === 'succeeded'
    ? 'succeeded'
    : value === 'canceled'
      ? 'canceled'
      : value === 'requires_payment_method'
        ? 'requires_payment_method'
        : value === 'requires_action' || value === 'requires_confirmation'
          ? 'requires_action'
          : 'processing';
const normalizeIntent = (
  value: Stripe.PaymentIntent,
): ProviderPaymentIntent => ({
  id: value.id,
  status: normalizeStatus(value.status),
  createdAt: new Date(value.created * 1000),
  clientSecret: value.client_secret,
  localPaymentId: value.metadata.localPaymentId ?? null,
});
const normalizeRefund = (value: Stripe.Refund): ProviderRefund => ({
  id: value.id,
  status:
    value.status === 'succeeded'
      ? 'succeeded'
      : value.status === 'failed' || value.status === 'canceled'
        ? 'failed'
        : 'pending',
  createdAt: new Date(value.created * 1000),
});
async function safe<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Stripe.errors.StripeCardError)
      throw new ProviderFailure('provider_declined');
    if (error instanceof Stripe.errors.StripeConnectionError)
      throw new ProviderFailure('provider_timeout');
    if (error instanceof Stripe.errors.StripeInvalidRequestError)
      throw new ProviderFailure('provider_invalid_state');
    throw new ProviderFailure('provider_unavailable');
  }
}
export function createStripeProvider(secretKey: string): PaymentProvider {
  const stripe = new Stripe(secretKey, { maxNetworkRetries: 2 });
  return {
    createPaymentIntent: (input, key) =>
      safe(async () =>
        normalizeIntent(
          await stripe.paymentIntents.create(
            {
              amount: input.amountMinor,
              currency: 'inr',
              capture_method: 'automatic',
              automatic_payment_methods: { enabled: true },
              metadata: { localPaymentId: input.localPaymentId },
            },
            { idempotencyKey: key },
          ),
        ),
      ),
    retrievePaymentIntent: (id) =>
      safe(async () =>
        normalizeIntent(await stripe.paymentIntents.retrieve(id)),
      ),
    cancelPaymentIntent: (id, key) =>
      safe(async () =>
        normalizeIntent(
          await stripe.paymentIntents.cancel(id, {}, { idempotencyKey: key }),
        ),
      ),
    createRefund: (id, amount, key) =>
      safe(async () =>
        normalizeRefund(
          await stripe.refunds.create(
            { payment_intent: id, amount },
            { idempotencyKey: key },
          ),
        ),
      ),
    retrieveRefund: (id) =>
      safe(async () => normalizeRefund(await stripe.refunds.retrieve(id))),
    constructWebhookEvent(raw, signature, secret, tolerance) {
      try {
        const event = stripe.webhooks.constructEvent(
          raw,
          signature,
          secret,
          tolerance,
        );
        const object = event.data.object as
          Stripe.PaymentIntent | Stripe.Refund;
        const localPaymentId =
          'metadata' in object
            ? (object.metadata?.localPaymentId ?? null)
            : null;
        return {
          id: event.id,
          type: event.type,
          objectId: object.id,
          localPaymentId,
          createdAt: new Date(event.created * 1000),
          status: 'status' in object ? String(object.status) : 'unknown',
        } as ProviderEvent;
      } catch {
        throw new ProviderFailure('signature_invalid');
      }
    },
  };
}
