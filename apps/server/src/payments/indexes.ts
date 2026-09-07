import type { Model } from 'mongoose';
import type { PaymentModels } from './repository.js';
export const expectedPaymentIndexes = {
  payments: [
    { name: 'payment_booking_unique', key: { bookingId: 1 }, unique: true },
    {
      name: 'payment_intent_unique',
      key: { providerPaymentIntentId: 1 },
      unique: true,
      partialFilterExpression: { providerPaymentIntentId: { $type: 'string' } },
    },
    {
      name: 'payment_owner_created',
      key: { userId: 1, createdAt: -1, _id: -1 },
    },
    {
      name: 'payment_admin_status_updated',
      key: { status: 1, updatedAt: -1, _id: -1 },
    },
    {
      name: 'payment_reconciliation_due',
      key: { reconciliationState: 1, nextReconcileAt: 1, _id: 1 },
      partialFilterExpression: {
        reconciliationState: { $in: ['required', 'in_progress', 'failed'] },
      },
    },
  ],
  events: [
    {
      name: 'payment_event_provider_unique',
      key: { providerEventId: 1 },
      unique: true,
    },
    {
      name: 'payment_event_payment_created',
      key: { paymentId: 1, providerCreatedAt: -1, _id: -1 },
    },
  ],
} as const;
async function verify(
  model: Model<unknown>,
  expected: readonly {
    name: string;
    key: object;
    unique?: true;
    partialFilterExpression?: object;
  }[],
) {
  const actual = await model.collection.indexes();
  for (const value of expected) {
    const found = actual.find((index) => index.name === value.name);
    if (
      !found ||
      JSON.stringify(found.key) !== JSON.stringify(value.key) ||
      Boolean(found.unique) !== 'unique' in value ||
      JSON.stringify(found.partialFilterExpression ?? null) !==
        JSON.stringify(
          'partialFilterExpression' in value
            ? value.partialFilterExpression
            : null,
        ) ||
      found.sparse ||
      found.expireAfterSeconds !== undefined ||
      found.collation
    )
      throw new Error('Payment indexes are unavailable');
  }
}
export async function verifyPaymentIndexes(models: PaymentModels) {
  try {
    await verify(models.payments, expectedPaymentIndexes.payments);
    await verify(models.events, expectedPaymentIndexes.events);
  } catch {
    throw new Error('Payment indexes are unavailable');
  }
}
export async function provisionPaymentIndexes(models: PaymentModels) {
  await models.payments.createCollection();
  await models.events.createCollection();
  await models.payments.createIndexes();
  await models.events.createIndexes();
  await verifyPaymentIndexes(models);
}
