import type { Model } from 'mongoose';
export interface BookingModels {
  bookings: Model<unknown>;
  occupancies: Model<unknown>;
}
export const expectedBookingIndexes = {
  bookings: [
    {
      name: 'booking_owner_created',
      key: { userId: 1, createdAt: -1, _id: -1 },
    },
    {
      name: 'booking_admin_status_start',
      key: { status: 1, startDate: 1, _id: 1 },
    },
    {
      name: 'booking_car_active_range',
      key: { carId: 1, status: 1, endDateExclusive: 1, startDate: 1 },
    },
  ],
  occupancies: [
    {
      name: 'booking_occupancy_car_date_unique',
      key: { carId: 1, date: 1 },
      unique: true,
    },
    { name: 'booking_occupancy_booking', key: { bookingId: 1 } },
  ],
} as const;
async function verify(
  model: Model<unknown>,
  expected: readonly { name: string; key: object; unique?: true }[],
) {
  const actual = await model.collection.indexes();
  for (const e of expected) {
    const found = actual.find((i) => i.name === e.name);
    if (
      !found ||
      JSON.stringify(found.key) !== JSON.stringify(e.key) ||
      Boolean(found.unique) !== 'unique' in e ||
      found.sparse ||
      found.partialFilterExpression ||
      found.collation ||
      found.expireAfterSeconds !== undefined
    )
      throw new Error('Booking indexes are unavailable');
  }
}
export async function verifyBookingIndexes(m: BookingModels) {
  try {
    await verify(m.bookings, expectedBookingIndexes.bookings);
    await verify(m.occupancies, expectedBookingIndexes.occupancies);
  } catch {
    throw new Error('Booking indexes are unavailable');
  }
}
export async function provisionBookingIndexes(m: BookingModels) {
  await m.bookings.createCollection();
  await m.occupancies.createCollection();
  await m.bookings.createIndexes();
  await m.occupancies.createIndexes();
  await verifyBookingIndexes(m);
}
