import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CustomerBooking } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { BookingActions } from '../components/BookingActions';
import { BookingStatus } from '../components/BookingStatus';
export function BookingDetailPage() {
  const { id = '' } = useParams(),
    auth = useAuth(),
    [b, setB] = useState<CustomerBooking>(),
    [error, setError] = useState(false),
    [pending, setPending] = useState(false);
  useEffect(() => {
    void auth.bookingDetail!(id)
      .then(setB)
      .catch(() => setError(true));
  }, [auth.bookingDetail, id]);
  if (error)
    return (
      <main>
        <h1>Booking unavailable</h1>
      </main>
    );
  if (!b) return <p role="status">Loading booking…</p>;
  return (
    <main>
      <h1>
        {b.car.make} {b.car.model}
      </h1>
      <BookingStatus status={b.status} />
      <p>
        {b.startDate} to {b.endDateExclusive}
      </p>
      <p>Total ₹{b.total.amountMinor / 100}</p>
      <BookingActions
        booking={b}
        pending={pending}
        onAction={() => {
          setPending(true);
          void auth.cancelBooking!(b.id, b.revision)
            .then(setB)
            .finally(() => setPending(false));
        }}
      />
    </main>
  );
}
