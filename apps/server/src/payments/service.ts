import type { PaymentStatus } from '@lets-secureride-ai/contracts';
import type { BookingRepository } from '../bookings/repository.js';
import { AppError } from '../utils/app-error.js';
import type { PaymentEvents } from './events.js';
import {
  isPaymentStartEligible,
  isStripeAmountSupported,
  requiresConfirmation,
} from './lifecycle.js';
import type { PaymentProvider } from './provider.js';
import { ProviderFailure } from './provider.js';
import type { PaymentRepository } from './repository.js';
import { toAdminPayment, toCustomerPayment } from './response.js';
const missing = () =>
  new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment was not found');
const normalized = (value: string): PaymentStatus =>
  [
    'requires_payment_method',
    'requires_action',
    'processing',
    'succeeded',
    'canceled',
  ].includes(value)
    ? (value as PaymentStatus)
    : 'reconciliation_required';
export function createPaymentService(
  repository: PaymentRepository,
  bookings: BookingRepository,
  provider: PaymentProvider,
  events: PaymentEvents,
  publishableKey: string,
) {
  return {
    async start(
      bookingId: string,
      userId: string,
      revision: number,
      requestId: string,
    ) {
      const booking = await bookings.findOwner(bookingId, userId);
      if (!booking) throw missing();
      if (booking.revision !== revision)
        throw new AppError(
          409,
          'PAYMENT_STALE',
          'Payment changed; reload and try again',
        );
      if (!isPaymentStartEligible(booking.status))
        throw new AppError(
          409,
          'PAYMENT_BOOKING_INELIGIBLE',
          'Booking is not eligible for payment',
        );
      if (
        booking.currency !== 'INR' ||
        !isStripeAmountSupported(booking.totalAmountMinor)
      )
        throw new AppError(
          422,
          'PAYMENT_AMOUNT_UNSUPPORTED',
          'This booking total cannot be processed',
        );
      const local = await repository.findOrCreate(booking);
      let payment = local.payment;
      if (
        payment.status === 'initializing' ||
        payment.status === 'reconciliation_required'
      ) {
        try {
          const intent = await provider.createPaymentIntent(
            {
              amountMinor: payment.amountMinor,
              currency: 'INR',
              localPaymentId: payment.id,
            },
            payment.createIdempotencyKey,
          );
          payment =
            (await repository.bindIntent(
              payment.id,
              intent.id,
              normalized(intent.status),
              intent.createdAt,
            )) ?? payment;
          events({
            event: 'PAYMENT_INITIATED',
            outcome: 'success',
            operation: 'start',
            requestId,
            actorRole: 'customer',
          });
        } catch (error) {
          const category =
            error instanceof ProviderFailure
              ? error.category
              : 'provider_unknown_outcome';
          await repository.markReconciliation(payment.id, category);
          throw new AppError(
            503,
            'PAYMENT_PROVIDER_UNAVAILABLE',
            'Payment service is temporarily unavailable',
          );
        }
      }
      const result: {
        payment: ReturnType<typeof toCustomerPayment>;
        confirmation?: { publishableKey: string; clientSecret: string };
      } = { payment: toCustomerPayment(payment) };
      if (
        requiresConfirmation(payment.status) &&
        payment.providerPaymentIntentId
      ) {
        const intent = await provider.retrievePaymentIntent(
          payment.providerPaymentIntentId,
        );
        if (intent.clientSecret)
          result.confirmation = {
            publishableKey,
            clientSecret: intent.clientSecret,
          };
      }
      return result;
    },
    async ownerByBooking(bookingId: string, userId: string) {
      const payment = await repository.findOwnerByBooking(bookingId, userId);
      if (!payment) throw missing();
      return toCustomerPayment(payment);
    },
    async owner(id: string, userId: string) {
      const payment = await repository.findOwner(id, userId);
      if (!payment) throw missing();
      return toCustomerPayment(payment);
    },
    async list(
      userId: string,
      query: { status: string; page: number; pageSize: number },
    ) {
      const result = await repository.list(userId, query);
      return {
        ...result,
        items: result.items.map(toCustomerPayment),
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(result.totalItems / query.pageSize),
      };
    },
    async admin(id: string) {
      const payment = await repository.findAdmin(id);
      if (!payment) throw missing();
      return toAdminPayment(payment);
    },
    async adminList(query: {
      status: string;
      refundStatus: string;
      reconciliationState: string;
      page: number;
      pageSize: number;
    }) {
      const result = await repository.list(undefined, query);
      return {
        ...result,
        items: result.items.map(toAdminPayment),
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(result.totalItems / query.pageSize),
      };
    },
    async reconcile(id: string, revision: number) {
      const payment = await repository.findAdmin(id);
      if (!payment) throw missing();
      if (payment.revision !== revision)
        throw new AppError(
          409,
          'PAYMENT_STALE',
          'Payment changed; reload and try again',
        );
      if (!payment.providerPaymentIntentId)
        throw new AppError(
          409,
          'PAYMENT_RECONCILIATION_REQUIRED',
          'Payment requires reconciliation',
        );
      const intent = await provider.retrievePaymentIntent(
        payment.providerPaymentIntentId,
      );
      const updated = await repository.bindIntent(
        payment.id,
        intent.id,
        normalized(intent.status),
        intent.createdAt,
      );
      if (!updated)
        throw new AppError(
          409,
          'PAYMENT_INVALID_TRANSITION',
          'Payment action is not allowed',
        );
      return toAdminPayment(updated);
    },
    async refund(id: string, revision: number) {
      const payment = await repository.startRefund(id, revision);
      if (!payment)
        throw new AppError(
          409,
          'PAYMENT_INVALID_TRANSITION',
          'Payment action is not allowed',
        );
      if (!payment.providerPaymentIntentId || !payment.refund.idempotencyKey)
        throw new AppError(
          409,
          'PAYMENT_RECONCILIATION_REQUIRED',
          'Payment requires reconciliation',
        );
      try {
        const refund = await provider.createRefund(
          payment.providerPaymentIntentId,
          payment.amountMinor,
          payment.refund.idempotencyKey,
        );
        return toAdminPayment(
          (await repository.finishRefund(
            payment.id,
            refund.id,
            refund.status,
          )) ?? payment,
        );
      } catch {
        await repository.markReconciliation(
          payment.id,
          'provider_unknown_outcome',
        );
        throw new AppError(
          503,
          'PAYMENT_PROVIDER_UNAVAILABLE',
          'Payment service is temporarily unavailable',
        );
      }
    },
  };
}
export type PaymentService = ReturnType<typeof createPaymentService>;
