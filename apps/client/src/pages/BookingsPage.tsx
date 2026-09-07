import { useEffect, useState } from 'react';
import type { BookingListData } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { BookingList } from '../components/BookingList';
export function BookingsPage() {
  const auth = useAuth(),
    [data, setData] = useState<BookingListData>(),
    [error, setError] = useState(false);
  useEffect(() => {
    let a = true;
    void auth.listBookings!({ page: 1, pageSize: 20, status: 'all' })
      .then((v) => {
        if (a) setData(v);
      })
      .catch(() => {
        if (a) setError(true);
      });
    return () => {
      a = false;
    };
  }, [auth.listBookings]);
  return (
    <main>
      <h1>Your bookings</h1>
      {error ? (
        <p role="alert">Unable to load bookings.</p>
      ) : !data ? (
        <p role="status">Loading bookings…</p>
      ) : data.items.length ? (
        <BookingList items={data.items} />
      ) : (
        <p>No bookings yet.</p>
      )}
    </main>
  );
}
