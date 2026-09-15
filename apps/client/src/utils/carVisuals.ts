import type { CarSummary } from '@lets-secureride-ai/contracts';

const inventoryImages: Record<string, string> = {
  LOCAL_DEMO_LUXURY_01: '/images/car-luxury.webp',
  LOCAL_DEMO_HATCH_01: '/images/car-hatchback.webp',
  LOCAL_DEMO_SEDAN_01: '/images/car-electric.webp',
  LOCAL_DEMO_SUV_01: '/images/car-suv.webp',
  LOCAL_DEMO_SPORT_01: '/images/car-sport.webp',
  LOCAL_DEMO_VAN_01: '/images/car-van.webp',
};

export function localCarImage(
  car: Pick<CarSummary, 'inventoryCode' | 'category' | 'fuelType'>,
) {
  return (
    inventoryImages[car.inventoryCode] ??
    (car.fuelType === 'electric'
      ? '/images/car-electric.webp'
      : car.category === 'luxury'
        ? '/images/car-luxury.webp'
        : car.category === 'hatchback'
          ? '/images/car-hatchback.webp'
          : car.category === 'van'
            ? '/images/car-van.webp'
            : '/images/car-suv.webp')
  );
}
