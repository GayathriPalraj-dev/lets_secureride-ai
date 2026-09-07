import type { PaymentStatus, Role } from '@lets-secureride-ai/contracts';
export type PaymentEventName =
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_ACTION_REQUIRED'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_INTENT_CANCELLED'
  | 'REFUND_REQUESTED'
  | 'REFUND_SUCCEEDED'
  | 'REFUND_FAILED'
  | 'PAYMENT_WEBHOOK_REJECTED'
  | 'PAYMENT_WEBHOOK_DUPLICATE'
  | 'PAYMENT_RECONCILIATION_REQUIRED'
  | 'PAYMENT_RECONCILED'
  | 'PAYMENT_PROVIDER_OPERATION_FAILED';
export interface SafePaymentEvent {
  event: PaymentEventName;
  outcome: 'success' | 'failure' | 'ignored';
  operation: string;
  requestId?: string;
  actorRole?: Role;
  fromStatus?: PaymentStatus;
  toStatus?: PaymentStatus;
  failureCategory?: string;
}
export type PaymentEvents = (event: SafePaymentEvent) => void;
export const createPaymentEvents =
  (write: PaymentEvents): PaymentEvents =>
  (event) =>
    write({ ...event });
