import type {
  AdminPayment,
  CustomerPayment,
} from '@lets-secureride-ai/contracts';
import type { PaymentRecord } from './types.js';
export function toCustomerPayment(payment: PaymentRecord): CustomerPayment {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    amount: { amountMinor: payment.amountMinor, currency: 'INR' },
    status: payment.status,
    refundStatus: payment.refund.status,
    failureCategory: payment.failureCategory,
    revision: payment.revision,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}
export function toAdminPayment(payment: PaymentRecord): AdminPayment {
  return {
    ...toCustomerPayment(payment),
    customerReference: 'customer-' + payment.userId.slice(-8),
    booking: { id: payment.bookingId, ...payment.bookingSnapshot },
    reconciliationState: payment.reconciliationState,
    retryEligible:
      payment.reconciliationState !== 'none' ||
      payment.refund.status === 'failed',
  };
}
