import type {
  ProviderEvent,
  ProviderPaymentIntent,
  ProviderRefund,
} from './types.js';
export interface PaymentProvider {
  createPaymentIntent(
    input: { amountMinor: number; currency: 'INR'; localPaymentId: string },
    key: string,
  ): Promise<ProviderPaymentIntent>;
  retrievePaymentIntent(id: string): Promise<ProviderPaymentIntent>;
  cancelPaymentIntent(id: string, key: string): Promise<ProviderPaymentIntent>;
  createRefund(
    id: string,
    amountMinor: number,
    key: string,
  ): Promise<ProviderRefund>;
  retrieveRefund(id: string): Promise<ProviderRefund>;
  constructWebhookEvent(
    raw: Buffer,
    signature: string,
    secret: string,
    tolerance: number,
  ): ProviderEvent;
}
export type ProviderFailureCategory =
  | 'provider_unavailable'
  | 'provider_declined'
  | 'provider_invalid_state'
  | 'provider_timeout'
  | 'provider_unknown_outcome'
  | 'signature_invalid';
export class ProviderFailure extends Error {
  constructor(readonly category: ProviderFailureCategory) {
    super('Payment provider operation failed');
  }
}
