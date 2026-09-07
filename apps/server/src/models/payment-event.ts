import { Schema, type Connection, type InferSchemaType } from 'mongoose';
export const supportedPaymentEvents = [
  'payment_intent.processing',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'refund.created',
  'refund.updated',
  'refund.failed',
] as const;
export const paymentEventSchema = new Schema(
  {
    providerEventId: { type: String, required: true, maxlength: 255 },
    providerObjectId: { type: String, required: true, maxlength: 255 },
    eventType: { type: String, required: true, enum: supportedPaymentEvents },
    paymentId: { type: Schema.Types.ObjectId, required: true },
    providerCreatedAt: { type: Date, required: true },
    outcome: {
      type: String,
      required: true,
      enum: ['applied', 'duplicate', 'ignored', 'reconcile_required'],
    },
  },
  { timestamps: true, autoCreate: false, autoIndex: false, strict: 'throw' },
);
paymentEventSchema.index(
  { providerEventId: 1 },
  { name: 'payment_event_provider_unique', unique: true },
);
paymentEventSchema.index(
  { paymentId: 1, providerCreatedAt: -1, _id: -1 },
  { name: 'payment_event_payment_created' },
);
export type PaymentEventDocument = InferSchemaType<typeof paymentEventSchema>;
export const createPaymentEventModel = (connection: Connection) =>
  connection.model('PaymentEvent', paymentEventSchema, 'payment_events');
