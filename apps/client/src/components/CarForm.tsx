import { useState, type FormEvent } from 'react';
import type { AdminCar, CreateCarRequest } from '@lets-secureride-ai/contracts';
const empty: CreateCarRequest = {
  inventoryCode: '',
  registrationNumber: '',
  make: '',
  model: '',
  year: new Date().getFullYear(),
  category: 'sedan',
  transmission: 'automatic',
  fuelType: 'petrol',
  seats: 5,
  dailyRateMinor: 100000,
  description: '',
  features: [],
};
export function CarForm({
  car,
  pending,
  onSubmit,
  onCancel,
}: {
  car?: AdminCar | undefined;
  pending?: boolean;
  onSubmit(value: CreateCarRequest): Promise<void>;
  onCancel?(): void;
}) {
  const [value, setValue] = useState<CreateCarRequest>(
    car
      ? {
          inventoryCode: car.inventoryCode,
          registrationNumber: car.registrationNumber,
          make: car.make,
          model: car.model,
          year: car.year,
          category: car.category,
          transmission: car.transmission,
          fuelType: car.fuelType,
          seats: car.seats,
          dailyRateMinor: car.dailyRate.amountMinor,
          description: car.description,
          features: car.features,
        }
      : empty,
  );
  const field = (
    key: keyof CreateCarRequest,
    next: string | number | string[],
  ) => setValue((current) => ({ ...current, [key]: next }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({
      ...value,
      inventoryCode: value.inventoryCode.trim(),
      registrationNumber: value.registrationNumber.trim(),
      make: value.make.trim(),
      model: value.model.trim(),
      description: value.description.trim(),
      features: value.features.map((item) => item.trim()).filter(Boolean),
    });
  }
  return (
    <form className="car-form" onSubmit={(e) => void submit(e)}>
      <h2>{car ? 'Edit car' : 'Add car'}</h2>
      <label>
        Inventory code
        <input
          required
          disabled={!!car}
          value={value.inventoryCode}
          onChange={(e) => field('inventoryCode', e.target.value)}
        />
      </label>
      <label>
        Registration number
        <input
          required
          disabled={!!car}
          value={value.registrationNumber}
          onChange={(e) => field('registrationNumber', e.target.value)}
        />
      </label>
      <label>
        Make
        <input
          required
          value={value.make}
          onChange={(e) => field('make', e.target.value)}
        />
      </label>
      <label>
        Model
        <input
          required
          value={value.model}
          onChange={(e) => field('model', e.target.value)}
        />
      </label>
      <label>
        Year
        <input
          required
          type="number"
          value={value.year}
          onChange={(e) => field('year', Number(e.target.value))}
        />
      </label>
      <label>
        Seats
        <input
          required
          type="number"
          value={value.seats}
          onChange={(e) => field('seats', Number(e.target.value))}
        />
      </label>
      <label>
        Daily rate (paise)
        <input
          required
          type="number"
          value={value.dailyRateMinor}
          onChange={(e) => field('dailyRateMinor', Number(e.target.value))}
        />
      </label>
      <label>
        Category
        <select
          value={value.category}
          onChange={(e) => field('category', e.target.value)}
        >
          {['hatchback', 'sedan', 'suv', 'luxury', 'van'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        Transmission
        <select
          value={value.transmission}
          onChange={(e) => field('transmission', e.target.value)}
        >
          <option>manual</option>
          <option>automatic</option>
        </select>
      </label>
      <label>
        Fuel type
        <select
          value={value.fuelType}
          onChange={(e) => field('fuelType', e.target.value)}
        >
          {['petrol', 'diesel', 'electric', 'hybrid'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        Description
        <textarea
          required
          value={value.description}
          onChange={(e) => field('description', e.target.value)}
        />
      </label>
      <label>
        Features (comma separated)
        <input
          value={value.features.join(', ')}
          onChange={(e) => field('features', e.target.value.split(','))}
        />
      </label>
      <button disabled={pending} type="submit">
        Save car
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
