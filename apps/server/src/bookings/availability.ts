import { DAY_MS } from './pricing.js';
export function occupancyDates(start: Date, end: Date) {
  const result: Date[] = [];
  for (let time = start.getTime(); time < end.getTime(); time += DAY_MS)
    result.push(new Date(time));
  if (!result.length || result.length > 30)
    throw new Error('Invalid booking range');
  return result;
}
export interface AvailabilityRepository {
  hasOccupancy(carId: string, dates: Date[]): Promise<boolean>;
  hasBlockingBooking(carId: string, after: Date): Promise<boolean>;
}
export const createAvailability = (repo: AvailabilityRepository) => ({
  async available(carId: string, start: Date, end: Date) {
    return !(await repo.hasOccupancy(carId, occupancyDates(start, end)));
  },
  hasBlockingBooking: (carId: string, after: Date) =>
    repo.hasBlockingBooking(carId, after),
});
