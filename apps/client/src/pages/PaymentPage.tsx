import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import type {
  CustomerBooking,
  CustomerPayment,
  PaymentConfirmation,
} from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { PaymentForm } from '../components/PaymentForm';
import { PaymentStatus } from '../components/PaymentStatus';
import { PaymentError } from '../services/payments';
export function PaymentPage() {
  const { bookingId = '' } = useParams(),
    auth = useAuth(),
    [booking, setBooking] = useState<CustomerBooking>(),
    [payment, setPayment] = useState<CustomerPayment>(),
    [confirmation, setConfirmation] = useState<PaymentConfirmation>(),
    [stripe, setStripe] = useState<Stripe | null>(),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void auth.bookingDetail!(bookingId)
      .then((value) => {
        if (active) setBooking(value);
      })
      .catch(() => {
        if (active) setError('Unable to load this booking.');
      });
    return () => {
      active = false;
      setConfirmation(undefined);
      setStripe(undefined);
    };
  }, [auth.bookingDetail, bookingId]);
  async function start() {
    if (!booking) return;
    setError('');
    try {
      const result = await auth.startPayment!(booking.id, booking.revision);
      setPayment(result.payment);
      if (result.confirmation) {
        setConfirmation(result.confirmation);
        setStripe(await loadStripe(result.confirmation.publishableKey));
      }
    } catch (failure) {
      setError(
        failure instanceof PaymentError &&
          failure.code === 'PAYMENT_AMOUNT_UNSUPPORTED'
          ? 'This booking total cannot be processed.'
          : 'Payment is temporarily unavailable.',
      );
    }
  }
  if (error)
    return (
      <main>
        <h1>Payment</h1>
        <p role="alert">{error}</p>
        {booking && <button onClick={() => void start()}>Retry</button>}
      </main>
    );
  if (!booking) return <p role="status">Loading payment…</p>;
  return (
    <main>
      <h1>
        Payment for {booking.car.make} {booking.car.model}
      </h1>
      <p>Total ₹{booking.total.amountMinor / 100}</p>
      {payment && (
        <PaymentStatus
          status={payment.status}
          refundStatus={payment.refundStatus}
        />
      )}
      {confirmation && stripe ? (
        <Elements
          stripe={stripe}
          options={{ clientSecret: confirmation.clientSecret }}
        >
          <PaymentForm
            returnUrl={`${window.location.origin}/payments/return?payment=${encodeURIComponent(payment!.id)}`}
          />
        </Elements>
      ) : payment?.status === 'succeeded' ? (
        <p>Payment complete.</p>
      ) : (
        <button onClick={() => void start()}>Pay securely</button>
      )}
    </main>
  );
}
