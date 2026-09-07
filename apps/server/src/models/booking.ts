import { Schema, type Connection, type InferSchemaType } from 'mongoose';
export const bookingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    carId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    carSnapshot: {
      inventoryCode: {
        type: String,
        required: true,
        immutable: true,
        maxlength: 32,
      },
      make: { type: String, required: true, immutable: true, maxlength: 60 },
      model: { type: String, required: true, immutable: true, maxlength: 60 },
    },
    startDate: { type: Date, required: true, immutable: true },
    endDateExclusive: { type: Date, required: true, immutable: true },
    dailyRateMinor: {
      type: Number,
      required: true,
      immutable: true,
      min: 1,
      max: 100_000_000,
      validate: Number.isSafeInteger,
    },
    currency: { type: String, required: true, immutable: true, enum: ['INR'] },
    billableDays: {
      type: Number,
      required: true,
      immutable: true,
      min: 1,
      max: 30,
      validate: Number.isInteger,
    },
    totalAmountMinor: {
      type: Number,
      required: true,
      immutable: true,
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
      validate: Number.isSafeInteger,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'confirmed', 'rejected', 'cancelled'],
      default: 'pending',
    },
    revision: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isInteger,
    },
    statusChangedAt: { type: Date, required: true },
    statusChangedByRole: {
      type: String,
      required: true,
      enum: ['customer', 'admin'],
    },
    statusReason: { type: String, trim: true, maxlength: 300, default: null },
  },
  { timestamps: true, autoCreate: false, autoIndex: false, strict: 'throw' },
);
bookingSchema.index(
  { userId: 1, createdAt: -1, _id: -1 },
  { name: 'booking_owner_created' },
);
bookingSchema.index(
  { status: 1, startDate: 1, _id: 1 },
  { name: 'booking_admin_status_start' },
);
bookingSchema.index(
  { carId: 1, status: 1, endDateExclusive: 1, startDate: 1 },
  { name: 'booking_car_active_range' },
);
export type BookingDocument = InferSchemaType<typeof bookingSchema>;
export const createBookingModel = (connection: Connection) =>
  connection.model('Booking', bookingSchema, 'bookings');
