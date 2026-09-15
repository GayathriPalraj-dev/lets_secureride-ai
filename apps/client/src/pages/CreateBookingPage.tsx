import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BookingQuote } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { BookingForm } from '../components/BookingForm';
export function CreateBookingPage() {
  const { carId = '' } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<BookingQuote>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const body = (startDate: string, endDateExclusive: string) => ({
    carId,
    startDate,
    endDateExclusive,
  });
  return (
    <main id="main" className="page-shell booking-create-page">
      <section className="booking-visual">
        <div>
          <p className="eyebrow">Your journey starts here</p>
          <h1>Reserve your SecureRide</h1>
          <p>Choose your dates, review the exact price and book with confidence.</p>
        </div>
      </section>
      <section className="booking-create-card">
        <p className="eyebrow">Secure booking</p>
        <h2>Select your travel dates</h2>
        <BookingForm
        pending={pending}
        onQuote={async (start, end) => {
          setPending(true);
          try {
            setQuote(await auth.quoteBooking!(body(start, end)));
            setError('');
          } catch {
            setError('Unable to quote this booking.');
          } finally {
            setPending(false);
          }
        }}
        onCreate={async (start, end) => {
          setPending(true);
          try {
            const booking = await auth.createBooking!(body(start, end));
            navigate('/bookings/' + booking.id);
          } catch {
            setError('The car may no longer be available.');
          } finally {
            setPending(false);
          }
        }}
        />
        {quote && (
          <p className="quote-result" role="status">
            <span>{quote.available ? 'Available' : 'Unavailable'}</span>
            <strong>₹{quote.total.amountMinor / 100}</strong>
          </p>
        )}
        {error && <p className="booking-error" role="alert">{error}</p>}
        <p className="secure-note">🔒 Your booking details are encrypted and protected.</p>
      </section>
    </main>
  );
}
