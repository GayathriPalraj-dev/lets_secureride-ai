import { Router } from 'express';
import type { Config } from '../config/env.js';
import { healthRouter } from './health.js';
import { readinessRouter } from './readiness.js';
import { authRouter, type AuthDependencies } from './auth.js';
import { adminRouter } from './admin.js';
import type { AuthorizationEvents } from '../authorization/events.js';
import { adminCarsRouter, carsRouter } from './cars.js';
import type { CarService } from '../cars/service.js';
import { adminBookingsRouter, bookingsRouter } from './bookings.js';
import type { BookingService } from '../bookings/service.js';
export interface ApiDependencies {
  auth: AuthDependencies;
  authorizationEvents: AuthorizationEvents;
  cars?: CarService;
  bookings?: BookingService;
}
export function apiRouter(
  config: Config,
  isReady: () => boolean,
  dependencies?: ApiDependencies,
) {
  const router = Router();
  router.use(healthRouter(config));
  router.use(readinessRouter(isReady));
  if (dependencies) {
    router.use('/auth', authRouter(dependencies.auth));
    router.use(
      '/admin',
      adminRouter({
        service: dependencies.auth.service,
        events: dependencies.authorizationEvents,
      }),
    );
    if (dependencies.cars) {
      const carDependencies = {
        auth: dependencies.auth.service,
        cars: dependencies.cars,
        authorizationEvents: dependencies.authorizationEvents,
        origin: dependencies.auth.origin,
      };
      router.use('/cars', carsRouter(carDependencies));
      router.use('/admin/cars', adminCarsRouter(carDependencies));
    }
    if (dependencies.bookings) {
      const bookingDependencies = {
        auth: dependencies.auth.service,
        bookings: dependencies.bookings,
        authorizationEvents: dependencies.authorizationEvents,
        origin: dependencies.auth.origin,
      };
      router.use('/bookings', bookingsRouter(bookingDependencies));
      router.use('/admin/bookings', adminBookingsRouter(bookingDependencies));
    }
  }
  return router;
}
