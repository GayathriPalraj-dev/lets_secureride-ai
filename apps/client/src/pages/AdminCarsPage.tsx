import { useCallback, useEffect, useState } from 'react';
import type { AdminCar, CreateCarRequest } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { CarForm } from '../components/CarForm';
import { CarInventoryTable } from '../components/CarInventoryTable';
export function AdminCarsPage() {
  const auth = useAuth();
  const [cars, setCars] = useState<AdminCar[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [editing, setEditing] = useState<AdminCar>();
  const [showForm, setShowForm] = useState(false);
  const [pendingId, setPendingId] = useState<string>();
  const load = useCallback(
    async (showLoading = true) => {
      if (showLoading) setState('loading');
      try {
        const value = await auth.adminCars!({
          status: 'all',
          page: 1,
          pageSize: 50,
        });
        setCars(value.items);
        setState('ready');
      } catch {
        setState('error');
      }
    },
    [auth.adminCars],
  );
  useEffect(() => {
    let active = true;
    void auth.adminCars!({ status: 'all', page: 1, pageSize: 50 })
      .then((value) => {
        if (active) {
          setCars(value.items);
          setState('ready');
        }
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, [auth.adminCars]);
  async function save(body: CreateCarRequest) {
    setPendingId(editing?.id ?? 'new');
    try {
      if (editing) {
        const update = {
          make: body.make,
          model: body.model,
          year: body.year,
          category: body.category,
          transmission: body.transmission,
          fuelType: body.fuelType,
          seats: body.seats,
          dailyRateMinor: body.dailyRateMinor,
          description: body.description,
          features: body.features,
        };
        await auth.updateCar!(editing.id, editing.revision, update);
      } else await auth.createCar!(body);
      setEditing(undefined);
      setShowForm(false);
      await load();
    } finally {
      setPendingId(undefined);
    }
  }
  async function status(car: AdminCar) {
    setPendingId(car.id);
    try {
      await auth.setCarStatus!(
        car.id,
        car.revision,
        car.status === 'active' ? 'inactive' : 'active',
      );
      await load();
    } finally {
      setPendingId(undefined);
    }
  }
  async function remove(car: AdminCar) {
    if (!window.confirm(`Delete inactive ${car.make} ${car.model}?`)) return;
    setPendingId(car.id);
    try {
      await auth.deleteCar!(car.id, car.revision);
      await load();
    } finally {
      setPendingId(undefined);
    }
  }
  return (
    <main>
      <h1>Car inventory</h1>
      {cars.map((car) => (
        <a key={car.id} href={`/admin/cars/${car.id}/images`}>
          Manage images for {car.make} {car.model}
        </a>
      ))}
      <button
        onClick={() => {
          setEditing(undefined);
          setShowForm(true);
        }}
      >
        Add car
      </button>
      {showForm && (
        <CarForm
          car={editing}
          pending={!!pendingId}
          onSubmit={save}
          onCancel={() => setShowForm(false)}
        />
      )}
      {state === 'loading' ? (
        <p role="status">Loading inventory…</p>
      ) : state === 'error' ? (
        <>
          <p role="alert">Unable to load inventory.</p>
          <button onClick={() => void load()}>Retry</button>
        </>
      ) : cars.length === 0 ? (
        <p>No cars in inventory.</p>
      ) : (
        <CarInventoryTable
          cars={cars}
          pendingId={pendingId}
          onEdit={(car) => {
            setEditing(car);
            setShowForm(true);
          }}
          onStatus={(car) => void status(car)}
          onDelete={(car) => void remove(car)}
        />
      )}
    </main>
  );
}
