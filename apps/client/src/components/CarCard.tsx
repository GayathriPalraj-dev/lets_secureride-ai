import type { CarSummary } from '@lets-secureride-ai/contracts';
import { Link } from 'react-router-dom';
import { CarPrimaryImage } from './CarPrimaryImage';
export function CarCard({ car }: { car: CarSummary }) {
  const image = car.images?.find((value) => value.isPrimary) ?? car.images?.[0];
  return (
    <article className="car-card">
      {image ? (
        <CarPrimaryImage image={image} />
      ) : (
        <div
          className="car-image-fallback"
          aria-label="No car image available"
        />
      )}
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
