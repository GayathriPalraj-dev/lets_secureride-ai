import { useEffect, useState } from 'react';
import type { CustomerPayment } from '@lets-secureride-ai/contracts';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { PaymentStatus } from '../components/PaymentStatus';
export function PaymentReturnPage() {
  const [params] = useSearchParams(),
    id = params.get('payment') ?? '',
    auth = useAuth(),
    [payment, setPayment] = useState<CustomerPayment>(),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true,
      timer: number | undefined;
    const load = () =>
      void auth.paymentDetail!(id)
        .then((value) => {
          if (!active) return;
          setPayment(value);
          if (
            ['processing', 'initializing', 'reconciliation_required'].includes(
              value.status,
            )
          )
            timer = window.setTimeout(load, 2000);
        })
        .catch(() => active && setError(true));
    load();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [auth.paymentDetail, id]);
  return (
    <main>
      <h1>Payment status</h1>
      {error ? (
        <p role="alert">Unable to verify payment status.</p>
      ) : payment ? (
        <PaymentStatus
          status={payment.status}
          refundStatus={payment.refundStatus}
        />
      ) : (
        <p role="status">Verifying payment…</p>
      )}
    </main>
  );
}
