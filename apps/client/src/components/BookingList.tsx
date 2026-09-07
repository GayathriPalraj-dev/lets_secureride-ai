import type { CustomerBooking } from '@lets-secureride-ai/contracts';
import { Link } from 'react-router-dom';
import { BookingStatus } from './BookingStatus';
export function BookingList({
  items,
  admin = false,
}: {
  items: CustomerBooking[];
  admin?: boolean;
}) {
  return (
    <div className="booking-list">
      {items.map((b) => (
        <article key={b.id}>
          <h2>
            {b.car.make} {b.car.model}
          </h2>
          <BookingStatus status={b.status} />
          <p>
            {b.startDate} to {b.endDateExclusive}
          </p>
          <Link to={`${admin ? '/admin' : ''}/bookings/${b.id}`}>
            View booking
          </Link>
        </article>
      ))}
    </div>
  );
}
