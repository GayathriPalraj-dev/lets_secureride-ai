import type {
  PaymentStatus,
  RefundStatus,
} from '@lets-secureride-ai/contracts';
const terminal = new Set<PaymentStatus>(['succeeded', 'canceled']);
export const isPaymentStartEligible = (bookingStatus: string) =>
  bookingStatus === 'confirmed';
export const isStripeAmountSupported = (value: number) =>
  Number.isSafeInteger(value) && value >= 50 && value <= 999_999_999;
export function nextPaymentStatus(
  current: PaymentStatus,
  next: PaymentStatus,
  eventAt: Date,
  last: Date | null,
) {
  if (last && eventAt < last) return current;
  return terminal.has(current) ? current : next;
}
export function nextRefundStatus(current: RefundStatus, next: RefundStatus) {
  if (current === 'succeeded' || (current === 'pending' && next === 'required'))
    return current;
  return next;
}
export const requiresConfirmation = (status: PaymentStatus) =>
  status === 'requires_payment_method' || status === 'requires_action';
