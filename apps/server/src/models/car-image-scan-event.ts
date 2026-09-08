import { Schema, type Connection } from 'mongoose';
export const carImageScanEventSchema = new Schema(
  {
    providerEventId: { type: String, required: true, immutable: true },
    imageId: {
      type: String,
      required: true,
      immutable: true,
      match:
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    eventTime: { type: Date, required: true, immutable: true },
    outcome: {
      type: String,
      required: true,
      enum: ['clean', 'threat', 'unsupported', 'failed'],
    },
  },
  { timestamps: true, autoCreate: false, autoIndex: false, strict: 'throw' },
);
carImageScanEventSchema.index(
  { providerEventId: 1 },
  { name: 'car_image_scan_event_provider_unique', unique: true },
);
carImageScanEventSchema.index(
  { imageId: 1, eventTime: -1, _id: 1 },
  { name: 'car_image_scan_event_image_created' },
);
export const createCarImageScanEventModel = (c: Connection) =>
  c.model(
    'CarImageScanEvent',
    carImageScanEventSchema,
    'car_image_scan_events',
  );
