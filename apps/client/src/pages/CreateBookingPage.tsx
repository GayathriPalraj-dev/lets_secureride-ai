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
    <main>
      <h1>Create booking</h1>
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
        <p role="status">
          {quote.available ? 'Available' : 'Unavailable'} · ₹
          {quote.total.amountMinor / 100}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
