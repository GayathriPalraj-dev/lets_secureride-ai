import { Router, type RequestHandler } from 'express';
import type { AuthService } from '../auth/service.js';
import type { AuthorizationEvents } from '../authorization/events.js';
import type { CarService } from '../cars/service.js';
import { createCarController } from '../cars/controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authCsrf } from '../middleware/auth-csrf.js';
import { requireAnyRole, requireRole } from '../middleware/require-role.js';

export interface CarRouteDependencies {
  auth: AuthService;
  cars: CarService;
  authorizationEvents: AuthorizationEvents;
  origin: string;
}
const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
export function carsRouter(dependencies: CarRouteDependencies) {
  const router = Router();
  const controller = createCarController(dependencies.cars);
  router.use(
    noStore,
    authenticate(dependencies.auth),
    requireAnyRole(['customer', 'admin'], dependencies.authorizationEvents),
  );
  router.get('/', controller.list);
  router.get('/:carId', controller.detail);
  return router;
}
export function adminCarsRouter(dependencies: CarRouteDependencies) {
  const router = Router();
  const controller = createCarController(dependencies.cars);
  router.use(
    noStore,
    authenticate(dependencies.auth),
    requireRole('admin', dependencies.authorizationEvents),
  );
  router.get('/', controller.adminList);
  router.get('/:carId', controller.adminDetail);
  router.use(authCsrf(dependencies.origin));
  router.post('/', controller.create);
  router.put('/:carId', controller.replace);
  router.post('/:carId/activate', controller.activate);
  router.post('/:carId/deactivate', controller.deactivate);
  router.delete('/:carId', controller.remove);
  return router;
}
