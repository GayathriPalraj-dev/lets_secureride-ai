import { Router, type RequestHandler } from 'express';
import type { AuthService } from '../auth/service.js';
import type { AuthorizationEvents } from '../authorization/events.js';
import type { BookingService } from '../bookings/service.js';
import { createBookingController } from '../bookings/controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';
import { authCsrf } from '../middleware/auth-csrf.js';
export interface BookingRouteDependencies {
  auth: AuthService;
  bookings: BookingService;
  authorizationEvents: AuthorizationEvents;
  origin: string;
}
const noStore: RequestHandler = (_q, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
export function bookingsRouter(d: BookingRouteDependencies) {
  const r = Router(),
    c = createBookingController(d.bookings);
  r.use(
    noStore,
    authenticate(d.auth),
    requireRole('customer', d.authorizationEvents),
  );
  r.get('/', c.list);
  r.get('/:bookingId', c.detail);
  r.use(authCsrf(d.origin));
  r.post('/quote', c.quote);
  r.post('/', c.create);
  r.post('/:bookingId/cancel', c.cancel);
  return r;
}
export function adminBookingsRouter(d: BookingRouteDependencies) {
  const r = Router(),
    c = createBookingController(d.bookings);
  r.use(
    noStore,
    authenticate(d.auth),
    requireRole('admin', d.authorizationEvents),
  );
  r.get('/', c.adminList);
  r.get('/:bookingId', c.adminDetail);
  r.use(authCsrf(d.origin));
  r.post('/:bookingId/confirm', c.confirm);
  r.post('/:bookingId/reject', c.reject);
  r.post('/:bookingId/cancel', c.adminCancel);
  return r;
}
