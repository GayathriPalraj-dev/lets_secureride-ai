import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AdminBooking } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { BookingActions } from '../components/BookingActions';
import { BookingStatus } from '../components/BookingStatus';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { StatusPanel } from '../components/StatusPanel';

export function AdminBookingDetailPage() {
  const { id = '' } = useParams();
  const auth = useAuth();
  const [booking, setBooking] = useState<AdminBooking>();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    void auth.adminBooking!(id)
      .then((value) => {
        if (active) setBooking(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [auth.adminBooking, id]);
  const action = (name: 'confirm' | 'reject' | 'cancel', reason?: string) => {
    if (!booking) return;
    setPending(true);
    void auth.adminBookingAction!(booking.id, booking.revision, name, reason)
      .then(setBooking)
      .catch(() => setError(true))
      .finally(() => setPending(false));
  };
  return (
    <main id="main" className="page-shell">
      <DashboardLayout admin>
        <Link to="/admin/bookings">← Back to bookings</Link>
        {error ? (
          <StatusPanel tone="error" title="Booking unavailable">
            Please return to the booking list and try again.
          </StatusPanel>
        ) : !booking ? (
          <LoadingState label="Loading booking…" />
        ) : (
          <>
            <header className="page-intro">
              <p className="eyebrow">Booking review</p>
              <h1>
                {booking.car.make} {booking.car.model}
              </h1>
              <BookingStatus status={booking.status} />
            </header>
            <section className="auth-card">
              <dl>
                <dt>Customer reference</dt>
                <dd>{booking.customerReference}</dd>
                <dt>Journey</dt>
                <dd>
                  {booking.startDate} to {booking.endDateExclusive}
                </dd>
                <dt>Total</dt>
                <dd>₹{booking.total.amountMinor / 100}</dd>
              </dl>
              <BookingActions
                booking={booking}
                admin
                pending={pending}
                onAction={action}
              />
            </section>
          </>
        )}
      </DashboardLayout>
    </main>
  );
}
