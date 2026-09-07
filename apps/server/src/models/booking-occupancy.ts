import { Schema, type Connection } from 'mongoose';
export const bookingOccupancySchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    carId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    date: { type: Date, required: true, immutable: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    autoCreate: false,
    autoIndex: false,
    strict: 'throw',
  },
);
bookingOccupancySchema.index(
  { carId: 1, date: 1 },
  { name: 'booking_occupancy_car_date_unique', unique: true },
);
bookingOccupancySchema.index(
  { bookingId: 1 },
  { name: 'booking_occupancy_booking' },
);
export const createBookingOccupancyModel = (connection: Connection) =>
  connection.model(
    'BookingOccupancy',
    bookingOccupancySchema,
    'booking_occupancies',
  );
