import { Schema, type Connection } from 'mongoose';
export const carImageSetSchema = new Schema(
  {
    carId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    imageCount: { type: Number, required: true, min: 0, max: 8, default: 0 },
    primaryImageId: { type: Schema.Types.ObjectId, default: null },
    revision: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, autoCreate: false, autoIndex: false, strict: 'throw' },
);
carImageSetSchema.index(
  { carId: 1 },
  { name: 'car_image_set_car_unique', unique: true },
);
export const createCarImageSetModel = (c: Connection) =>
  c.model('CarImageSet', carImageSetSchema, 'car_image_sets');
