import { Schema, type Connection } from 'mongoose';
export const carImageSchema = new Schema(
  {
    publicId: { type: String, required: true, immutable: true },
    carId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    slot: { type: Number, required: true, min: 0, max: 7, immutable: true },
    quarantineObjectKey: { type: String, required: true, immutable: true },
    quarantineVersionId: { type: String, default: null },
    readyObjectKey: { type: String, default: null },
    readyVersionId: { type: String, default: null },
    status: {
      type: String,
      required: true,
      enum: [
        'pending_upload',
        'uploaded',
        'verification_pending',
        'ready',
        'rejected',
        'expired',
        'deleted',
      ],
      default: 'pending_upload',
    },
    declaredContentType: {
      type: String,
      required: true,
      enum: ['image/jpeg', 'image/png', 'image/webp'],
    },
    normalizedContentType: {
      type: String,
      enum: ['image/webp'],
      default: null,
    },
    expectedSize: { type: Number, required: true, min: 1, max: 8_388_608 },
    encodedSize: { type: Number, min: 1, max: 8_388_608, default: null },
    expectedChecksumSha256: { type: String, required: true },
    trustedChecksumSha256: { type: String, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    altText: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 160,
    },
    displayOrder: { type: Number, required: true, min: 0, max: 7 },
    isPrimary: { type: Boolean, required: true, default: false },
    revision: { type: Number, required: true, min: 0, default: 0 },
    scanState: {
      type: String,
      required: true,
      enum: ['pending', 'clean', 'threat', 'unsupported', 'failed'],
      default: 'pending',
    },
    reconciliationState: {
      type: String,
      required: true,
      enum: ['none', 'required', 'in_progress', 'failed'],
      default: 'none',
    },
    failureCategory: { type: String, default: null },
    lastScanEventTime: { type: Date, default: null },
    lastScanProviderEventId: { type: String, default: null },
    uploadExpiresAt: { type: Date, required: true },
    scanExpiresAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, autoCreate: false, autoIndex: false, strict: 'throw' },
);
carImageSchema.index(
  { publicId: 1 },
  { name: 'car_image_public_id_unique', unique: true },
);
carImageSchema.index(
  { quarantineObjectKey: 1 },
  { name: 'car_image_quarantine_key_unique', unique: true },
);
carImageSchema.index(
  { readyObjectKey: 1 },
  {
    name: 'car_image_ready_key_unique',
    unique: true,
    partialFilterExpression: { readyObjectKey: { $type: 'string' } },
  },
);
carImageSchema.index(
  { carId: 1, status: 1, displayOrder: 1, _id: 1 },
  { name: 'car_image_car_status_order' },
);
carImageSchema.index(
  { carId: 1, displayOrder: 1 },
  {
    name: 'car_image_car_live_order_unique',
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);
carImageSchema.index(
  { carId: 1, isPrimary: 1 },
  {
    name: 'car_image_car_primary_unique',
    unique: true,
    partialFilterExpression: {
      status: 'ready',
      isPrimary: true,
      deletedAt: null,
    },
  },
);
carImageSchema.index(
  { status: 1, uploadExpiresAt: 1, scanExpiresAt: 1, _id: 1 },
  { name: 'car_image_cleanup_due' },
);
export const createCarImageModel = (c: Connection) =>
  c.model('CarImage', carImageSchema, 'car_images');
