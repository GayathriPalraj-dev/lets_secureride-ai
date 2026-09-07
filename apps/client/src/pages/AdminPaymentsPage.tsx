import { useCallback, useEffect, useState } from 'react';
import type { AdminPayment } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { PaymentStatus } from '../components/PaymentStatus';
export function AdminPaymentsPage() {
  const auth = useAuth(),
    [items, setItems] = useState<AdminPayment[]>(),
    [error, setError] = useState(false);
  const load = useCallback(
    () =>
      auth.adminPayments!({ status: 'all', page: 1, pageSize: 20 }).then(
        (value) => setItems(value.items),
      ),
    [auth.adminPayments],
  );
  useEffect(() => {
    void load().catch(() => setError(true));
  }, [load]);
  const action = (payment: AdminPayment, name: 'reconcile' | 'refund') =>
    void auth.adminPaymentAction!(payment.id, payment.revision, name)
      .then(load)
      .catch(() => setError(true));
  return (
    <main>
      <h1>Payment administration</h1>
      {error && <p role="alert">Unable to complete the payment operation.</p>}
      {!items ? (
        <p role="status">Loading payments…</p>
      ) : items.length === 0 ? (
        <p>No payments found.</p>
      ) : (
        <ul>
          {items.map((payment) => (
            <li key={payment.id}>
              <span>{payment.customerReference}</span>
              <PaymentStatus
                status={payment.status}
                refundStatus={payment.refundStatus}
              />
              {payment.reconciliationState !== 'none' && (
                <button onClick={() => action(payment, 'reconcile')}>
                  Reconcile
                </button>
              )}
              {payment.refundStatus === 'failed' && (
                <button onClick={() => action(payment, 'refund')}>
                  Retry refund
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
