import { Schema, type Connection, type InferSchemaType } from 'mongoose';

export const paymentStatuses = [
  'initializing',
  'requires_payment_method',
  'requires_action',
  'processing',
  'succeeded',
  'canceled',
  'reconciliation_required',
] as const;
export const refundStatuses = [
  'none',
  'required',
  'pending',
  'succeeded',
  'failed',
] as const;
export const paymentSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    bookingRevisionAtStart: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
      immutable: true,
    },
    bookingSnapshot: {
      inventoryCode: { type: String, required: true, maxlength: 32 },
      make: { type: String, required: true, maxlength: 60 },
      model: { type: String, required: true, maxlength: 60 },
    },
    amountMinor: {
      type: Number,
      required: true,
      min: 50,
      max: 999_999_999,
      validate: Number.isSafeInteger,
      immutable: true,
    },
    currency: { type: String, enum: ['INR'], required: true, immutable: true },
    status: {
      type: String,
      enum: paymentStatuses,
      required: true,
      default: 'initializing',
    },
    providerPaymentIntentId: { type: String, maxlength: 255, default: null },
    createIdempotencyKey: {
      type: String,
      required: true,
      maxlength: 255,
      select: false,
    },
    providerCreatedAt: { type: Date, default: null },
    lastProviderEventCreatedAt: { type: Date, default: null },
    failureCategory: {
      type: String,
      enum: [
        'provider_unavailable',
        'provider_declined',
        'provider_invalid_state',
        'provider_timeout',
        'provider_unknown_outcome',
      ],
      default: null,
    },
    revision: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },
    reconciliationState: {
      type: String,
      enum: ['none', 'required', 'in_progress', 'failed'],
      default: 'none',
    },
    nextReconcileAt: { type: Date, default: null },
    reconcileAttempts: { type: Number, min: 0, max: 100, default: 0 },
    refund: {
      status: { type: String, enum: refundStatuses, default: 'none' },
      providerRefundId: { type: String, maxlength: 255, default: null },
      idempotencyKey: {
        type: String,
        maxlength: 255,
        default: null,
        select: false,
      },
      failureCategory: { type: String, maxlength: 64, default: null },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true, autoCreate: false, autoIndex: false, strict: 'throw' },
);
paymentSchema.index(
  { bookingId: 1 },
  { name: 'payment_booking_unique', unique: true },
);
paymentSchema.index(
  { providerPaymentIntentId: 1 },
  {
    name: 'payment_intent_unique',
    unique: true,
    partialFilterExpression: { providerPaymentIntentId: { $type: 'string' } },
  },
);
paymentSchema.index(
  { userId: 1, createdAt: -1, _id: -1 },
  { name: 'payment_owner_created' },
);
paymentSchema.index(
  { status: 1, updatedAt: -1, _id: -1 },
  { name: 'payment_admin_status_updated' },
);
paymentSchema.index(
  { reconciliationState: 1, nextReconcileAt: 1, _id: 1 },
  {
    name: 'payment_reconciliation_due',
    partialFilterExpression: {
      reconciliationState: { $in: ['required', 'in_progress', 'failed'] },
    },
  },
);
export type PaymentDocument = InferSchemaType<typeof paymentSchema>;
export const createPaymentModel = (connection: Connection) =>
  connection.model('Payment', paymentSchema, 'payments');
