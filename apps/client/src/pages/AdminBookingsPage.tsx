import { useCallback, useEffect, useState } from 'react';
import type { AdminBooking } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { BookingList } from '../components/BookingList';
import { BookingActions } from '../components/BookingActions';
export function AdminBookingsPage() {
  const auth = useAuth(),
    [items, setItems] = useState<AdminBooking[]>([]),
    [selected, setSelected] = useState<AdminBooking>(),
    [error, setError] = useState(false),
    [pending, setPending] = useState(false);
  const load = useCallback(
    () =>
      auth.adminBookings!({ status: 'all', page: 1, pageSize: 20 }).then((v) =>
        setItems(v.items),
      ),
    [auth.adminBookings],
  );
  useEffect(() => {
    void load().catch(() => setError(true));
  }, [load]);
  const action = (a: 'confirm' | 'reject' | 'cancel', reason?: string) => {
    if (!selected) return;
    setPending(true);
    void auth.adminBookingAction!(selected.id, selected.revision, a, reason)
      .then(setSelected)
      .then(load)
      .finally(() => setPending(false));
  };
  return (
    <main>
      <h1>Booking administration</h1>
      {error && <p role="alert">Unable to load bookings.</p>}
      {!items.length ? (
        <p>No bookings found.</p>
      ) : (
        <BookingList items={items} admin />
      )}
      {selected && (
        <>
          <p>Customer reference: {selected.customerReference}</p>
          <BookingActions
            booking={selected}
            admin
            pending={pending}
            onAction={action}
          />
        </>
      )}
      <button onClick={() => items[0] && setSelected(items[0])}>
        Open first booking
      </button>
    </main>
  );
}
