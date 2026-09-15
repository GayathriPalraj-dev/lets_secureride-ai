import type { CarSummary } from '@lets-secureride-ai/contracts';
import { Link } from 'react-router-dom';
import { CarPrimaryImage } from './CarPrimaryImage';
import { localCarImage } from '../utils/carVisuals';
export function CarCard({ car }: { car: CarSummary }) {
  const image = car.images?.find((value) => value.isPrimary) ?? car.images?.[0];
  return (
    <article className="car-card">
      {image ? (
        <CarPrimaryImage image={image} />
      ) : (
        <img
          src={localCarImage(car)}
          alt={`${car.make} ${car.model} on a scenic road`}
          loading="lazy"
        />
      )}
      <div className="car-card-body">
        <div className="car-card-heading">
          <div>
            <p className="eyebrow">{car.category}</p>
            <h2>
              {car.make} {car.model}
            </h2>
          </div>
          <strong>
            {new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: car.dailyRate.currency,
              maximumFractionDigits: 0,
            }).format(car.dailyRate.amountMinor / 100)}
            <small>/day</small>
          </strong>
        </div>
        <div className="car-spec-row" aria-label="Vehicle highlights">
          <span>{car.year}</span>
          <span>{car.seats} seats</span>
          <span>{car.transmission}</span>
          <span>{car.fuelType}</span>
        </div>
        <Link to={`/cars/${car.id}`}>View car</Link>
      </div>
    </article>
  );
}
