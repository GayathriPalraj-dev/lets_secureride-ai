import { randomUUID } from 'node:crypto';
import type {
  PaymentStatus,
  RefundStatus,
} from '@lets-secureride-ai/contracts';
import type { createPaymentModel } from '../models/payment.js';
import type { createPaymentEventModel } from '../models/payment-event.js';
import type { BookingRecord } from '../bookings/repository.js';
import type {
  PaymentRecord,
  ProviderEvent,
  ReconciliationState,
} from './types.js';
type Models = {
  payments: ReturnType<typeof createPaymentModel>;
  events: ReturnType<typeof createPaymentEventModel>;
};
type Row = Record<string, unknown> & { _id: { toString(): string } };
const nested = (v: unknown) => v as Record<string, unknown>;
const date = (v: unknown) => (v instanceof Date ? v : new Date(String(v)));
function map(r: Row): PaymentRecord {
  const b = nested(r.bookingSnapshot),
    f = nested(r.refund);
  return {
    id: r._id.toString(),
    bookingId: String(r.bookingId),
    userId: String(r.userId),
    bookingRevisionAtStart: Number(r.bookingRevisionAtStart),
    bookingSnapshot: {
      inventoryCode: String(b.inventoryCode),
      make: String(b.make),
      model: String(b.model),
    },
    amountMinor: Number(r.amountMinor),
    currency: 'INR',
    status: r.status as PaymentStatus,
    providerPaymentIntentId: r.providerPaymentIntentId
      ? String(r.providerPaymentIntentId)
      : null,
    createIdempotencyKey: String(r.createIdempotencyKey ?? ''),
    providerCreatedAt: r.providerCreatedAt ? date(r.providerCreatedAt) : null,
    lastProviderEventCreatedAt: r.lastProviderEventCreatedAt
      ? date(r.lastProviderEventCreatedAt)
      : null,
    failureCategory: (r.failureCategory ??
      null) as PaymentRecord['failureCategory'],
    revision: Number(r.revision),
    reconciliationState: r.reconciliationState as ReconciliationState,
    nextReconcileAt: r.nextReconcileAt ? date(r.nextReconcileAt) : null,
    reconcileAttempts: Number(r.reconcileAttempts),
    refund: {
      status: f.status as RefundStatus,
      providerRefundId: f.providerRefundId ? String(f.providerRefundId) : null,
      idempotencyKey: f.idempotencyKey ? String(f.idempotencyKey) : null,
      failureCategory: f.failureCategory ? String(f.failureCategory) : null,
      updatedAt: f.updatedAt ? date(f.updatedAt) : null,
    },
    createdAt: date(r.createdAt),
    updatedAt: date(r.updatedAt),
  };
}
const duplicate = (e: unknown, name: string) =>
  !!e &&
  typeof e === 'object' &&
  (e as { code?: number; message?: string }).code === 11000 &&
  String((e as { message?: string }).message).includes(name);
export interface PaymentRepository {
  findOrCreate(
    booking: BookingRecord,
  ): Promise<{ payment: PaymentRecord; created: boolean }>;
  findByBooking(bookingId: string): Promise<PaymentRecord | null>;
  findOwnerByBooking(
    bookingId: string,
    userId: string,
  ): Promise<PaymentRecord | null>;
  findOwner(id: string, userId: string): Promise<PaymentRecord | null>;
  findAdmin(id: string): Promise<PaymentRecord | null>;
  list(
    userId: string | undefined,
    q: {
      status: string;
      refundStatus?: string;
      reconciliationState?: string;
      page: number;
      pageSize: number;
    },
  ): Promise<{ items: PaymentRecord[]; totalItems: number }>;
  bindIntent(
    id: string,
    providerId: string,
    status: PaymentStatus,
    createdAt: Date,
  ): Promise<PaymentRecord | null>;
  markReconciliation(id: string, category: string): Promise<void>;
  applyEvent(
    event: ProviderEvent,
    status: PaymentStatus | undefined,
    refundStatus: RefundStatus | undefined,
  ): Promise<'applied' | 'duplicate' | 'ignored'>;
  startRefund(id: string, revision: number): Promise<PaymentRecord | null>;
  finishRefund(
    id: string,
    providerId: string,
    status: RefundStatus,
  ): Promise<PaymentRecord | null>;
}
export function createPaymentRepository(models: Models): PaymentRepository {
  const lean = async (q: unknown) => {
    const r = (await q) as Row | null;
    return r ? map(r) : null;
  };
  return {
    async findOrCreate(b) {
      const existing = await lean(
        models.payments
          .findOne({ bookingId: b.id })
          .select('+createIdempotencyKey +refund.idempotencyKey')
          .lean(),
      );
      if (existing) return { payment: existing, created: false };
      try {
        const rows = await models.payments.create([
          {
            bookingId: b.id,
            userId: b.userId,
            bookingRevisionAtStart: b.revision,
            bookingSnapshot: b.carSnapshot,
            amountMinor: b.totalAmountMinor,
            currency: 'INR',
            status: 'initializing',
            createIdempotencyKey: 'pi_' + randomUUID(),
          },
        ]);
        return { payment: map(rows[0]!.toObject() as Row), created: true };
      } catch (e) {
        if (!duplicate(e, 'payment_booking_unique')) throw e;
        const payment = await lean(
          models.payments
            .findOne({ bookingId: b.id })
            .select('+createIdempotencyKey +refund.idempotencyKey')
            .lean(),
        );
        if (!payment) throw e;
        return { payment, created: false };
      }
    },
    findByBooking: (bookingId) =>
      lean(
        models.payments
          .findOne({ bookingId })
          .select('+createIdempotencyKey +refund.idempotencyKey')
          .lean(),
      ),
    findOwnerByBooking: (bookingId, userId) =>
      lean(models.payments.findOne({ bookingId, userId }).lean()),
    findOwner: (id, userId) =>
      lean(models.payments.findOne({ _id: id, userId }).lean()),
    findAdmin: (id) =>
      lean(
        models.payments
          .findById(id)
          .select('+createIdempotencyKey +refund.idempotencyKey')
          .lean(),
      ),
    async list(userId, q) {
      const filter: Record<string, unknown> = {};
      if (userId) filter.userId = userId;
      if (q.status !== 'all') filter.status = q.status;
      if (q.refundStatus && q.refundStatus !== 'all')
        filter['refund.status'] = q.refundStatus;
      if (q.reconciliationState && q.reconciliationState !== 'all')
        filter.reconciliationState = q.reconciliationState;
      const [rows, totalItems] = await Promise.all([
        models.payments
          .find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((q.page - 1) * q.pageSize)
          .limit(q.pageSize)
          .lean(),
        models.payments.countDocuments(filter),
      ]);
      return { items: rows.map((r) => map(r as Row)), totalItems };
    },
    async bindIntent(id, providerId, status, createdAt) {
      return lean(
        models.payments
          .findOneAndUpdate(
            { _id: id, status: { $nin: ['succeeded', 'canceled'] } },
            {
              $set: {
                providerPaymentIntentId: providerId,
                status,
                providerCreatedAt: createdAt,
                reconciliationState: 'none',
              },
              $inc: { revision: 1 },
            },
            { new: true, runValidators: true },
          )
          .select('+createIdempotencyKey +refund.idempotencyKey')
          .lean(),
      );
    },
    async markReconciliation(id, category) {
      await models.payments.updateOne(
        { _id: id },
        {
          $set: {
            status: 'reconciliation_required',
            reconciliationState: 'required',
            failureCategory: category,
            nextReconcileAt: new Date(),
          },
          $inc: { revision: 1 },
        },
      );
    },
    async applyEvent(event, next, refund) {
      try {
        return await models.payments.db.transaction(async (session) => {
          const p = (
            event.localPaymentId
              ? await models.payments
                  .findById(event.localPaymentId)
                  .session(session)
                  .lean()
              : await models.payments
                  .findOne({ providerPaymentIntentId: event.objectId })
                  .session(session)
                  .lean()
          ) as Row | null;
          if (!p) return 'ignored';
          try {
            await models.events.create(
              [
                {
                  providerEventId: event.id,
                  providerObjectId: event.objectId,
                  eventType: event.type as never,
                  paymentId: String(p._id),
                  providerCreatedAt: event.createdAt,
                  outcome: 'applied',
                },
              ],
              { session },
            );
          } catch (e) {
            if (duplicate(e, 'payment_event_provider_unique'))
              return 'duplicate';
            throw e;
          }
          const last = p.lastProviderEventCreatedAt as Date | null;
          if (last && event.createdAt < last) return 'ignored';
          const set: Record<string, unknown> = {
            lastProviderEventCreatedAt: event.createdAt,
          };
          if (next) set.status = next;
          if (refund) set['refund.status'] = refund;
          if (p.status === 'succeeded' && next !== 'succeeded')
            delete set.status;
          if (p.status === 'canceled' && next !== 'canceled') delete set.status;
          await models.payments.updateOne(
            { _id: p._id },
            { $set: set, $inc: { revision: 1 } },
            { session },
          );
          return 'applied';
        });
      } catch (e) {
        if (duplicate(e, 'payment_event_provider_unique')) return 'duplicate';
        throw e;
      }
    },
    async startRefund(id, revision) {
      return lean(
        models.payments
          .findOneAndUpdate(
            {
              _id: id,
              revision,
              'refund.status': { $in: ['required', 'failed'] },
            },
            {
              $set: {
                'refund.status': 'pending',
                'refund.idempotencyKey': 'refund_' + randomUUID(),
                'refund.updatedAt': new Date(),
              },
              $inc: { revision: 1 },
            },
            { new: true },
          )
          .select('+createIdempotencyKey +refund.idempotencyKey')
          .lean(),
      );
    },
    async finishRefund(id, providerId, status) {
      return lean(
        models.payments
          .findByIdAndUpdate(
            id,
            {
              $set: {
                'refund.providerRefundId': providerId,
                'refund.status': status,
                'refund.updatedAt': new Date(),
              },
              $inc: { revision: 1 },
            },
            { new: true },
          )
          .select('+createIdempotencyKey +refund.idempotencyKey')
          .lean(),
      );
    },
  };
}
export type PaymentModels = Models;
