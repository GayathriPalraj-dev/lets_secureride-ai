import type {
  PaymentFailureCategory,
  PaymentStatus,
  RefundStatus,
} from '@lets-secureride-ai/contracts';
export type ReconciliationState =
  'none' | 'required' | 'in_progress' | 'failed';
export interface PaymentRecord {
  id: string;
  bookingId: string;
  userId: string;
  bookingRevisionAtStart: number;
  bookingSnapshot: { inventoryCode: string; make: string; model: string };
  amountMinor: number;
  currency: 'INR';
  status: PaymentStatus;
  providerPaymentIntentId: string | null;
  createIdempotencyKey: string;
  providerCreatedAt: Date | null;
  lastProviderEventCreatedAt: Date | null;
  failureCategory: PaymentFailureCategory | null;
  revision: number;
  reconciliationState: ReconciliationState;
  nextReconcileAt: Date | null;
  reconcileAttempts: number;
  refund: {
    status: RefundStatus;
    providerRefundId: string | null;
    idempotencyKey: string | null;
    failureCategory: string | null;
    updatedAt: Date | null;
  };
  createdAt: Date;
  updatedAt: Date;
}
export type ProviderStatus = Exclude<
  PaymentStatus,
  'initializing' | 'reconciliation_required'
>;
export interface ProviderPaymentIntent {
  id: string;
  status: ProviderStatus;
  createdAt: Date;
  clientSecret: string | null;
  localPaymentId: string | null;
}
export interface ProviderRefund {
  id: string;
  status: 'pending' | 'succeeded' | 'failed';
  createdAt: Date;
}
export interface ProviderEvent {
  id: string;
  type: string;
  objectId: string;
  localPaymentId: string | null;
  createdAt: Date;
  status: string;
}
