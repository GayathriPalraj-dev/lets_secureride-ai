import type { CarSummary } from '@lets-secureride-ai/contracts';
import { Link } from 'react-router-dom';
export function CarCard({ car }: { car: CarSummary }) {
  return (
    <article className="car-card">
      <h2>
        {car.make} {car.model}
      </h2>
      <p>
        {car.year} · {car.category} · {car.transmission}
      </p>
      <p>
        {car.seats} seats · {car.fuelType}
      </p>
      <strong>
        {new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: car.dailyRate.currency,
          maximumFractionDigits: 0,
        }).format(car.dailyRate.amountMinor / 100)}{' '}
        per day
      </strong>
      <Link to={`/cars/${car.id}`}>View details</Link>
    </article>
  );
}
