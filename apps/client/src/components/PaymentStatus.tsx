import type {
  PaymentStatus as Status,
  RefundStatus,
} from '@lets-secureride-ai/contracts';
const labels: Record<Status, string> = {
  initializing: 'Starting payment',
  requires_payment_method: 'Payment method required',
  requires_action: 'Action required',
  processing: 'Payment processing',
  succeeded: 'Paid',
  canceled: 'Payment cancelled',
  reconciliation_required: 'Payment status being verified',
};
export function PaymentStatus({
  status,
  refundStatus = 'none',
}: {
  status: Status;
  refundStatus?: RefundStatus;
}) {
  return (
    <p className={`payment-status payment-${status}`} role="status">
      {labels[status]}
      {refundStatus !== 'none' ? ` · Refund ${refundStatus}` : ''}
    </p>
  );
}
