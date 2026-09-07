import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CarDetail } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { CarError } from '../services/cars';
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
      <main>
        <p role="status">Loading car…</p>
      </main>
    );
  if (state === 'missing')
    return (
      <main>
        <h1>Car unavailable</h1>
        <Link to="/cars">Return to cars</Link>
      </main>
    );
  if (state === 'error')
    return (
      <main>
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
    <main>
      <Link to="/cars">Back to cars</Link>
      <h1>
        {car!.make} {car!.model}
      </h1>
      <p>{car!.description}</p>
      <dl>
        <dt>Year</dt>
        <dd>{car!.year}</dd>
        <dt>Seats</dt>
        <dd>{car!.seats}</dd>
        <dt>Transmission</dt>
        <dd>{car!.transmission}</dd>
        <dt>Fuel</dt>
        <dd>{car!.fuelType}</dd>
      </dl>
      <h2>Features</h2>
      <Link to={`/bookings/new/${car!.id}`}>Book this car</Link>
      {car!.features.length ? (
        <ul>
          {car!.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      ) : (
        <p>No features listed.</p>
      )}
    </main>
  );
}
