import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CarDetail } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { CarError } from '../services/cars';
import { CarImageGallery } from '../components/CarImageGallery';
import { localCarImage } from '../utils/carVisuals';
export function CarDetailPage() {
  const { carId = '' } = useParams();
  const auth = useAuth();
  const [car, setCar] = useState<CarDetail>();
  const [state, setState] = useState<'loading' | 'missing' | 'error'>(
    'loading',
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void auth.carDetail!(carId)
      .then((value) => {
        if (active) setCar(value);
      })
      .catch((error) => {
        if (active)
          setState(
            error instanceof CarError && error.status === 404
              ? 'missing'
              : 'error',
          );
      });
    return () => {
      active = false;
    };
  }, [auth.carDetail, carId, attempt]);
  if (state === 'loading' && !car)
    return (
      <main id="main" className="page-shell">
        <p role="status">Loading car…</p>
      </main>
    );
  if (state === 'missing')
    return (
      <main id="main" className="page-shell">
        <h1>Car unavailable</h1>
        <Link to="/cars">Return to cars</Link>
      </main>
    );
  if (state === 'error')
    return (
      <main id="main" className="page-shell">
        <p role="alert">Unable to load this car.</p>
        <button
          onClick={() => {
            setCar(undefined);
            setState('loading');
            setAttempt((x) => x + 1);
          }}
        >
          Retry
        </button>
      </main>
    );
  return (
    <main id="main" className="page-shell car-detail-page">
      <Link className="back-link" to="/cars">
        ← Back to cars
      </Link>
      <div className="car-detail-grid">
        <section className="car-detail-media" aria-label="Vehicle photography">
          {(car!.images ?? []).length ? (
            <CarImageGallery images={car!.images ?? []} />
          ) : (
            <img
              src={localCarImage(car!)}
              alt={`${car!.make} ${car!.model} on a scenic road`}
            />
          )}
          <span className="photo-badge">Verified vehicle</span>
        </section>
        <section className="car-detail-summary">
          <p className="eyebrow">
            {car!.category} · {car!.year}
          </p>
          <h1>
            {car!.make} {car!.model}
          </h1>
          <p className="car-detail-copy">{car!.description}</p>
          <div className="detail-rate">
            <strong>₹{car!.dailyRate.amountMinor / 100}</strong>
            <span> per day</span>
          </div>
          <dl className="car-detail-specs">
            <div>
              <dt>Seats</dt>
              <dd>{car!.seats}</dd>
            </div>
            <div>
              <dt>Transmission</dt>
              <dd>{car!.transmission}</dd>
            </div>
            <div>
              <dt>Fuel</dt>
              <dd>{car!.fuelType}</dd>
            </div>
            <div>
              <dt>Model year</dt>
              <dd>{car!.year}</dd>
            </div>
          </dl>
          <Link
            className="button detail-book-button"
            to={`/bookings/new/${car!.id}`}
          >
            Check availability
          </Link>
          <p className="secure-note">
            ✓ Secure booking · Transparent pricing · Verified inventory
          </p>
        </section>
      </div>
      <section className="detail-features">
        <div>
          <p className="eyebrow">Included with your ride</p>
          <h2>Comfort and capability</h2>
        </div>
        {car!.features.length ? (
          <ul>
            {car!.features.map((feature) => (
              <li key={feature}>✓ {feature}</li>
            ))}
          </ul>
        ) : (
          <p>No features listed.</p>
        )}
      </section>
    </main>
  );
}
