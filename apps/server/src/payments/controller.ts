import type { RequestHandler, Response } from 'express';
import type { PaymentService } from './service.js';
import {
  adminPaymentListSchema,
  emptyPaymentSchema,
  paymentId,
  paymentListSchema,
  paymentRevision,
  parsePayment,
  refundSchema,
} from './validation.js';
const ok = (
  response: Response,
  requestId: string,
  data: unknown,
  status = 200,
) => {
  response.status(status).json({ success: true, data, requestId });
};
const etag = (response: Response, value: { revision: number }) =>
  response.setHeader('ETag', `"${value.revision}"`);
export function createPaymentController(service: PaymentService) {
  const wrap =
    (
      work: (
        request: Parameters<RequestHandler>[0],
        response: Response,
      ) => Promise<void>,
    ): RequestHandler =>
    async (request, response, next) => {
      try {
        await work(request, response);
      } catch (error) {
        next(error);
      }
    };
  return {
    start: wrap(async (request, response) => {
      parsePayment(emptyPaymentSchema, request.body);
      const data = await service.start(
        paymentId(request.params.bookingId),
        request.auth!.userId,
        paymentRevision(request.headers['if-match']),
        request.requestId,
      );
      etag(response, data.payment);
      ok(response, request.requestId, data, 201);
    }),
    byBooking: wrap(async (request, response) => {
      const payment = await service.ownerByBooking(
        paymentId(request.params.bookingId),
        request.auth!.userId,
      );
      etag(response, payment);
      ok(response, request.requestId, { payment });
    }),
    list: wrap(async (request, response) =>
      ok(
        response,
        request.requestId,
        await service.list(
          request.auth!.userId,
          parsePayment(paymentListSchema, request.query),
        ),
      ),
    ),
    detail: wrap(async (request, response) => {
      const payment = await service.owner(
        paymentId(request.params.paymentId),
        request.auth!.userId,
      );
      etag(response, payment);
      ok(response, request.requestId, { payment });
    }),
    adminList: wrap(async (request, response) =>
      ok(
        response,
        request.requestId,
        await service.adminList(
          parsePayment(adminPaymentListSchema, request.query),
        ),
      ),
    ),
    adminDetail: wrap(async (request, response) => {
      const payment = await service.admin(paymentId(request.params.paymentId));
      etag(response, payment);
      ok(response, request.requestId, { payment });
    }),
    reconcile: wrap(async (request, response) => {
      parsePayment(emptyPaymentSchema, request.body);
      const payment = await service.reconcile(
        paymentId(request.params.paymentId),
        paymentRevision(request.headers['if-match']),
      );
      etag(response, payment);
      ok(response, request.requestId, { payment });
    }),
    refund: wrap(async (request, response) => {
      parsePayment(refundSchema, request.body);
      const payment = await service.refund(
        paymentId(request.params.paymentId),
        paymentRevision(request.headers['if-match']),
      );
      etag(response, payment);
      ok(response, request.requestId, { payment });
    }),
  };
}
