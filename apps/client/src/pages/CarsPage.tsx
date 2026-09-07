import { useEffect, useState } from 'react';
import type { CarListData, CarListQuery } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { CarFilters } from '../components/CarFilters';
import { CarCard } from '../components/CarCard';
import { Pagination } from '../components/Pagination';
export function CarsPage() {
  const auth = useAuth();
  const [filters, setFilters] = useState<CarListQuery>({
    page: 1,
    pageSize: 12,
    sort: 'make_asc',
  });
  const [data, setData] = useState<CarListData>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void auth.listCars!(filters)
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [auth.listCars, filters, attempt]);
  return (
    <main>
      <h1>Available cars</h1>
      <CarFilters
        value={filters}
        onChange={(value) => {
          setError(false);
          setData(undefined);
          setFilters(value);
        }}
      />
      {error ? (
        <>
          <p role="alert">Unable to load cars.</p>
          <button
            onClick={() => {
              setError(false);
              setData(undefined);
              setAttempt((x) => x + 1);
            }}
          >
            Retry
          </button>
        </>
      ) : !data ? (
        <p role="status">Loading cars…</p>
      ) : data.items.length === 0 ? (
        <p>No cars match these filters.</p>
      ) : (
        <>
          <div className="car-grid">
            {data.items.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(page) => setFilters((x) => ({ ...x, page }))}
          />
        </>
      )}
    </main>
  );
}
