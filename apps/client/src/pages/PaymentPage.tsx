import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import type { CustomerBooking, CustomerPayment, PaymentConfirmation } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { PaymentForm } from '../components/PaymentForm';
import { PaymentStatus } from '../components/PaymentStatus';
import { PaymentError } from '../services/payments';

const money = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minor / 100);

export function PaymentPage() {
  const { bookingId = '' } = useParams(), auth = useAuth();
  const [booking, setBooking] = useState<CustomerBooking>(), [payment, setPayment] = useState<CustomerPayment>();
  const [confirmation, setConfirmation] = useState<PaymentConfirmation>(), [stripe, setStripe] = useState<Stripe | null>();
  const [method, setMethod] = useState<'online' | 'pay_at_pickup'>('online'), [coupon, setCoupon] = useState('');
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  useEffect(() => { let active = true; void auth.bookingDetail!(bookingId).then(v => active && setBooking(v)).catch(() => active && setError('Unable to load this booking.')); return () => { active = false; }; }, [auth.bookingDetail, bookingId]);
  async function start() {
    if (!booking || pending) return;
    setPending(true); setError('');
    try {
      const result = await auth.startPayment!(booking.id, booking.revision, method, coupon.trim() || undefined);
      setPayment(result.payment);
      if (result.confirmation) { setConfirmation(result.confirmation); setStripe(await loadStripe(result.confirmation.publishableKey)); }
    } catch (failure) {
      const code = failure instanceof PaymentError ? failure.code : '';
      setError(code === 'COUPON_INVALID' ? 'That coupon is invalid or not eligible for this booking.' : code === 'PAYMENT_ALREADY_STARTED' ? 'Payment has already started with different options.' : code === 'PAYMENT_AMOUNT_UNSUPPORTED' ? 'This booking total cannot be processed.' : 'Payment is temporarily unavailable.');
    } finally { setPending(false); }
  }
  if (!booking) return <main id="main" className="page-shell"><p role="status">Loading payment…</p>{error && <p role="alert">{error}</p>}</main>;
  const original = payment?.originalAmount.amountMinor ?? booking.total.amountMinor, discount = payment?.discount.amountMinor ?? 0, total = payment?.amount.amountMinor ?? original;
  return <main id="main" className="page-shell payment-page">
    <header className="payment-heading"><div><p className="eyebrow">Secure checkout</p><h1>Complete your booking</h1><p>{booking.car.make} {booking.car.model} · {booking.billableDays} day{booking.billableDays === 1 ? '' : 's'}</p></div><span className="secure-pill">Secure payment</span></header>
    <div className="checkout-layout"><section className="checkout-card" aria-labelledby="payment-method-title">
      <h2 id="payment-method-title">Choose payment method</h2>
      <div className="payment-methods">
        <label className={method === 'online' ? 'selected' : ''}><input type="radio" name="method" checked={method === 'online'} onChange={() => setMethod('online')} disabled={!!payment}/><strong>UPI or Card</strong><span>Pay securely through Stripe</span></label>
        <label className={method === 'pay_at_pickup' ? 'selected' : ''}><input type="radio" name="method" checked={method === 'pay_at_pickup'} onChange={() => setMethod('pay_at_pickup')} disabled={!!payment}/><strong>Pay at pickup</strong><span>Pay when you collect the car</span></label>
      </div>
      {!payment && <div className="coupon-box"><label htmlFor="coupon">Coupon code</label><div><input id="coupon" value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} placeholder="Enter coupon" maxLength={24}/><button type="button" onClick={() => void start()} disabled={pending}>{pending ? 'Applying…' : method === 'online' ? 'Continue' : 'Confirm option'}</button></div><small>Try WELCOME10 for 10% off.</small></div>}
      {error && <p role="alert" className="checkout-error">{error}</p>}
      {payment && <PaymentStatus status={payment.status} refundStatus={payment.refundStatus}/>}
      {confirmation && stripe && <Elements stripe={stripe} options={{ clientSecret: confirmation.clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#0877ee', borderRadius: '10px' } } }}><PaymentForm returnUrl={`${window.location.origin}/payments/return?payment=${encodeURIComponent(payment!.id)}`}/></Elements>}
      {payment?.method === 'pay_at_pickup' && <div className="pickup-note"><strong>Pay at pickup selected</strong><p>Bring a valid driving licence and pay the final amount at vehicle collection.</p></div>}
    </section><aside className="order-summary"><h2>Price summary</h2><dl><div><dt>Rental charge</dt><dd>{money(original)}</dd></div>{discount > 0 && <div className="discount"><dt>Coupon {payment?.couponCode}</dt><dd>−{money(discount)}</dd></div>}<div className="summary-total"><dt>Total payable</dt><dd>{money(total)}</dd></div></dl><p>No hidden online payment fees.</p></aside></div>
  </main>;
}
