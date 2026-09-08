import { Router, type RequestHandler } from 'express';
import type { AuthService } from '../auth/service.js';
import type { AuthorizationEvents } from '../authorization/events.js';
import type { CarImageService } from '../car-images/service.js';
import { createCarImageController } from '../car-images/controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authCsrf } from '../middleware/auth-csrf.js';
import { requireAnyRole, requireRole } from '../middleware/require-role.js';

export interface CarImageRouteDependencies {
  auth: AuthService;
  service: CarImageService;
  authorizationEvents: AuthorizationEvents;
  origin: string;
  limit(
    category: 'upload' | 'complete' | 'manage' | 'read' | 'event',
  ): RequestHandler;
}
const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
export function carImagesRouter(d: CarImageRouteDependencies) {
  const router = Router(),
    c = createCarImageController(d.service);
  router.get(
    '/cars/:carId/images',
    noStore,
    authenticate(d.auth),
    requireAnyRole(['customer', 'admin'], d.authorizationEvents),
    d.limit('read'),
    c.customerList,
  );
  router.get(
    '/cars/:carId/images/:imageId/content',
    authenticate(d.auth),
    requireAnyRole(['customer', 'admin'], d.authorizationEvents),
    d.limit('read'),
    c.content,
  );
  router.use(
    '/admin/cars/:carId/images',
    noStore,
    authenticate(d.auth),
    requireRole('admin', d.authorizationEvents),
  );
  router.get('/admin/cars/:carId/images', d.limit('manage'), c.adminList);
  router.post(
    '/admin/cars/:carId/images/uploads',
    authCsrf(d.origin),
    d.limit('upload'),
    c.authorize,
  );
  router.post(
    '/admin/cars/:carId/images/:imageId/complete',
    authCsrf(d.origin),
    d.limit('complete'),
    c.complete,
  );
  router.patch(
    '/admin/cars/:carId/images/:imageId',
    authCsrf(d.origin),
    d.limit('manage'),
    c.update,
  );
  router.post(
    '/admin/cars/:carId/images/:imageId/primary',
    authCsrf(d.origin),
    d.limit('manage'),
    c.primary,
  );
  router.delete(
    '/admin/cars/:carId/images/:imageId',
    authCsrf(d.origin),
    d.limit('manage'),
    c.remove,
  );
  return router;
}
