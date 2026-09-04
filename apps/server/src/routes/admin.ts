import { Router } from 'express';
import type { AuthService } from '../auth/service.js';
import type { AuthorizationEvents } from '../authorization/events.js';
import { adminAccess } from '../admin/controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';

export interface AdminDependencies {
  service: AuthService;
  events: AuthorizationEvents;
}

export function adminRouter(dependencies: AdminDependencies) {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get(
    '/access',
    authenticate(dependencies.service),
    requireRole('admin', dependencies.events),
    adminAccess,
  );
  return router;
}
