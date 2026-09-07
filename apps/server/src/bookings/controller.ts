import type { RequestHandler, Response } from 'express';
import type { BookingService } from './service.js';
import {
  adminBookingListSchema,
  bookingDatesSchema,
  bookingId,
  bookingListSchema,
  bookingRevision,
  emptySchema,
  parseBooking,
  reasonSchema,
} from './validation.js';
import type {
  ParsedAdminBookingList,
  ParsedBookingList,
} from './repository.js';
const ok = (res: Response, requestId: string, data: unknown, status = 200) => {
  res.status(status).json({ success: true, data, requestId });
};
const tag = (res: Response, b: { revision: number }) =>
  res.setHeader('ETag', `"${b.revision}"`);
export function createBookingController(service: BookingService) {
  const wrap =
    (
      fn: (req: Parameters<RequestHandler>[0], res: Response) => Promise<void>,
    ): RequestHandler =>
    async (req, res, next) => {
      try {
        await fn(req, res);
      } catch (e) {
        next(e);
      }
    };
  return {
    quote: wrap(async (req, res) =>
      ok(res, req.requestId, {
        quote: await service.quote(
          parseBooking(bookingDatesSchema, req.body),
          req.requestId,
        ),
      }),
    ),
    create: wrap(async (req, res) => {
      const b = await service.create(
        req.auth!.userId,
        parseBooking(bookingDatesSchema, req.body),
        req.requestId,
      );
      tag(res, b);
      ok(res, req.requestId, { booking: b }, 201);
    }),
    list: wrap(async (req, res) =>
      ok(
        res,
        req.requestId,
        await service.listOwner(
          req.auth!.userId,
          parseBooking(bookingListSchema, req.query) as ParsedBookingList,
          req.requestId,
        ),
      ),
    ),
    detail: wrap(async (req, res) => {
      const b = await service.ownerDetail(
        bookingId(req.params.bookingId),
        req.auth!.userId,
        req.requestId,
      );
      tag(res, b);
      ok(res, req.requestId, { booking: b });
    }),
    cancel: wrap(async (req, res) => {
      parseBooking(emptySchema, req.body);
      const b = await service.mutate(
        bookingId(req.params.bookingId),
        req.auth!.userId,
        bookingRevision(req.headers['if-match']),
        'cancel',
        'customer',
        null,
        req.requestId,
      );
      tag(res, b);
      ok(res, req.requestId, { booking: b });
    }),
    adminList: wrap(async (req, res) =>
      ok(
        res,
        req.requestId,
        await service.adminList(
          parseBooking(
            adminBookingListSchema,
            req.query,
          ) as ParsedAdminBookingList,
          req.requestId,
        ),
      ),
    ),
    adminDetail: wrap(async (req, res) => {
      const b = await service.adminDetail(
        bookingId(req.params.bookingId),
        req.requestId,
      );
      tag(res, b);
      ok(res, req.requestId, { booking: b });
    }),
    confirm: wrap(async (req, res) => {
      parseBooking(emptySchema, req.body);
      const b = await service.mutate(
        bookingId(req.params.bookingId),
        undefined,
        bookingRevision(req.headers['if-match']),
        'confirm',
        'admin',
        null,
        req.requestId,
      );
      tag(res, b);
      ok(res, req.requestId, { booking: b });
    }),
    reject: wrap(async (req, res) => {
      const body = parseBooking(reasonSchema, req.body);
      const b = await service.mutate(
        bookingId(req.params.bookingId),
        undefined,
        bookingRevision(req.headers['if-match']),
        'reject',
        'admin',
        body.reason ?? null,
        req.requestId,
      );
      tag(res, b);
      ok(res, req.requestId, { booking: b });
    }),
    adminCancel: wrap(async (req, res) => {
      const body = parseBooking(reasonSchema, req.body);
      const b = await service.mutate(
        bookingId(req.params.bookingId),
        undefined,
        bookingRevision(req.headers['if-match']),
        'cancel',
        'admin',
        body.reason ?? null,
        req.requestId,
      );
      tag(res, b);
      ok(res, req.requestId, { booking: b });
    }),
  };
}
