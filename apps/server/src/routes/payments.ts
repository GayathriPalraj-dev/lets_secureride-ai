import { Router, type RequestHandler } from 'express';
import type { AuthService } from '../auth/service.js';
import type { AuthorizationEvents } from '../authorization/events.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';
import { authCsrf } from '../middleware/auth-csrf.js';
import type { PaymentService } from '../payments/service.js';
import { createPaymentController } from '../payments/controller.js';
export interface PaymentRouteDependencies {
  auth: AuthService;
  payments: PaymentService;
  authorizationEvents: AuthorizationEvents;
  origin: string;
  limiter(
    category: 'start' | 'status' | 'history' | 'admin' | 'reconcile' | 'refund',
  ): RequestHandler;
}
const noStore: RequestHandler = (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
};
export function paymentsRouter(d: PaymentRouteDependencies) {
  const router = Router(),
    controller = createPaymentController(d.payments);
  router.use(
    noStore,
    authenticate(d.auth),
    requireRole('customer', d.authorizationEvents),
  );
  router.get('/', d.limiter('history'), controller.list);
  router.get('/:paymentId', d.limiter('status'), controller.detail);
  return router;
}
export function bookingPaymentsRouter(d: PaymentRouteDependencies) {
  const router = Router(),
    controller = createPaymentController(d.payments);
  router.use(
    noStore,
    authenticate(d.auth),
    requireRole('customer', d.authorizationEvents),
  );
  router.get('/:bookingId/payment', d.limiter('status'), controller.byBooking);
  router.post(
    '/:bookingId/payment-session',
    authCsrf(d.origin),
    d.limiter('start'),
    controller.start,
  );
  return router;
}
export function adminPaymentsRouter(d: PaymentRouteDependencies) {
  const router = Router(),
    controller = createPaymentController(d.payments);
  router.use(
    noStore,
    authenticate(d.auth),
    requireRole('admin', d.authorizationEvents),
  );
  router.get('/', d.limiter('admin'), controller.adminList);
  router.get('/:paymentId', d.limiter('admin'), controller.adminDetail);
  router.post(
    '/:paymentId/reconcile',
    authCsrf(d.origin),
    d.limiter('reconcile'),
    controller.reconcile,
  );
  router.post(
    '/:paymentId/refund',
    authCsrf(d.origin),
    d.limiter('refund'),
    controller.refund,
  );
  return router;
}
