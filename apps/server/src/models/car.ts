import { Schema, type Connection, type InferSchemaType } from 'mongoose';

const displayString = (maximum: number) => ({
  type: String,
  required: true,
  trim: true,
  minlength: 1,
  maxlength: maximum,
});

export const carSchema = new Schema(
  {
    inventoryCode: {
      ...displayString(32),
      minlength: 3,
      uppercase: true,
    },
    registrationNumber: {
      ...displayString(32),
      minlength: 3,
      uppercase: true,
    },
    registrationKey: {
      ...displayString(32),
      minlength: 3,
      uppercase: true,
    },
    make: displayString(60),
    makeKey: { ...displayString(60), lowercase: true },
    model: displayString(60),
    modelKey: { ...displayString(60), lowercase: true },
    year: {
      type: Number,
      required: true,
      min: 1990,
      max: new Date().getFullYear() + 1,
      validate: Number.isInteger,
    },
    category: {
      type: String,
      required: true,
      enum: ['hatchback', 'sedan', 'suv', 'luxury', 'van'],
    },
    transmission: {
      type: String,
      required: true,
      enum: ['manual', 'automatic'],
    },
    fuelType: {
      type: String,
      required: true,
      enum: ['petrol', 'diesel', 'electric', 'hybrid'],
    },
    seats: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      validate: Number.isInteger,
    },
    dailyRateMinor: {
      type: Number,
      required: true,
      min: 1,
      max: 100_000_000,
      validate: Number.isInteger,
    },
    currency: { type: String, required: true, enum: ['INR'], default: 'INR' },
    description: displayString(2000),
    features: {
      type: [{ type: String, trim: true, minlength: 1, maxlength: 60 }],
      required: true,
      default: undefined,
      validate: {
        validator: (values: string[]) =>
          values.length <= 20 && new Set(values).size === values.length,
        message: 'Features must be unique and contain at most 20 values',
      },
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'inactive'],
      default: 'inactive',
    },
    revision: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isInteger,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, autoCreate: false, autoIndex: false, strict: 'throw' },
);

carSchema.index(
  { inventoryCode: 1 },
  { name: 'car_inventory_code_unique', unique: true },
);
carSchema.index(
  { registrationKey: 1 },
  { name: 'car_registration_unique', unique: true },
);
carSchema.index(
  { status: 1, deletedAt: 1, category: 1, dailyRateMinor: 1, _id: 1 },
  { name: 'car_public_price_listing' },
);
carSchema.index(
  { status: 1, deletedAt: 1, makeKey: 1, modelKey: 1, _id: 1 },
  { name: 'car_public_make_listing' },
);
carSchema.index(
  { deletedAt: 1, status: 1, updatedAt: -1, _id: 1 },
  { name: 'car_admin_inventory_listing' },
);

export type CarDocument = InferSchemaType<typeof carSchema>;
export function createCarModel(connection: Connection) {
  return connection.model('Car', carSchema, 'cars');
}
