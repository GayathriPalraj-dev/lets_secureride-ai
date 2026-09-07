import { useRef, useState } from 'react';
import {
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
export function PaymentForm({ returnUrl }: { returnUrl: string }) {
  const stripe = useStripe(),
    elements = useElements(),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    alert = useRef<HTMLParagraphElement>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || pending) return;
    setPending(true);
    setError('');
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    if (result.error) {
      setError('Payment could not be confirmed. Check your details and retry.');
      setPending(false);
      queueMicrotask(() => alert.current?.focus());
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} aria-busy={pending}>
      <PaymentElement />
      <button disabled={!stripe || pending}>
        {pending ? 'Confirming…' : 'Pay securely'}
      </button>
      {error && (
        <p ref={alert} tabIndex={-1} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
