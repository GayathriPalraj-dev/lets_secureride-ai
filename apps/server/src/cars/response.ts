import type {
  AdminCar,
  CarDetail,
  CarSummary,
} from '@lets-secureride-ai/contracts';
import type { CarRecord } from './repository.js';

const toPublicDailyRate = (amountMinor: number) => ({
  amountMinor,
  currency: 'INR' as const,
});

export function toCarSummary(car: CarRecord): CarSummary {
  return {
    id: car.id,
    inventoryCode: car.inventoryCode,
    make: car.make,
    model: car.model,
    year: car.year,
    category: car.category,
    transmission: car.transmission,
    fuelType: car.fuelType,
    seats: car.seats,
    dailyRate: toPublicDailyRate(car.dailyRateMinor),
  };
}
export function allowCustomerCarSummary(car: CarSummary): CarSummary {
  return {
    id: car.id,
    inventoryCode: car.inventoryCode,
    make: car.make,
    model: car.model,
    year: car.year,
    category: car.category,
    transmission: car.transmission,
    fuelType: car.fuelType,
    seats: car.seats,
    dailyRate: toPublicDailyRate(car.dailyRate.amountMinor),
  };
}
export function allowCustomerCarDetail(car: CarDetail): CarDetail {
  return {
    id: car.id,
    inventoryCode: car.inventoryCode,
    make: car.make,
    model: car.model,
    year: car.year,
    category: car.category,
    transmission: car.transmission,
    fuelType: car.fuelType,
    seats: car.seats,
    dailyRate: toPublicDailyRate(car.dailyRate.amountMinor),
    description: car.description,
    features: [...car.features],
  };
}
export function toCarDetail(car: CarRecord): CarDetail {
  return {
    ...toCarSummary(car),
    description: car.description,
    features: [...car.features],
  };
}
export function toAdminCar(car: CarRecord): AdminCar {
  return {
    ...toCarDetail(car),
    registrationNumber: car.registrationNumber,
    status: car.status,
    revision: car.revision,
    createdAt: car.createdAt.toISOString(),
    updatedAt: car.updatedAt.toISOString(),
  };
}
