import { S3Client } from '@aws-sdk/client-s3';
import { createApp } from './app.js';
import { imageEnvironment, parseEnv, parseDatabaseEnv } from './config/env.js';
import { createLogger } from './config/logger.js';
import {
  createDatabaseManager,
  createMongooseContext,
} from './config/database.js';
import { parseAuthEnv } from './config/auth.js';
import { createAuthModels, createAuthRepository } from './auth/repository.js';
import { createPasswordService } from './auth/password-service.js';
import { createTokenService } from './auth/token-service.js';
import { createAuthService } from './auth/service.js';
import { createAuthEvents } from './auth/events.js';
import { createAuthorizationEvents } from './authorization/events.js';
import { createCarModel } from './models/car.js';
import { createCarRepository } from './cars/repository.js';
import { createCarService } from './cars/service.js';
import { createCarEvents } from './cars/events.js';
import { createBookingModel } from './models/booking.js';
import { createBookingOccupancyModel } from './models/booking-occupancy.js';
import { createBookingRepository } from './bookings/repository.js';
import { createBookingService } from './bookings/service.js';
import { createBookingEvents } from './bookings/events.js';
import { parsePaymentEnv } from './config/payments.js';
import { createPaymentModel } from './models/payment.js';
import { createPaymentEventModel } from './models/payment-event.js';
import { createPaymentRepository } from './payments/repository.js';
import { createStripeProvider } from './payments/stripe-provider.js';
import { createPaymentEvents } from './payments/events.js';
import { createPaymentService } from './payments/service.js';
import { createWebhookService } from './payments/webhook-service.js';
import { createPaymentLimiter } from './middleware/payment-rate-limit.js';
import { paymentWebhookRouter } from './routes/payment-webhook.js';
import { parseImageConfig } from './config/images.js';
import { createCarImageModel } from './models/car-image.js';
import { createCarImageSetModel } from './models/car-image-set.js';
import { createCarImageScanEventModel } from './models/car-image-scan-event.js';
import { createImageRepository } from './car-images/repository.js';
import { createS3ImageStorage } from './car-images/s3-storage.js';
import { createSharpProcessor } from './car-images/sharp-processor.js';
import { createCarImageEvents } from './car-images/events.js';
import { createCarImageService } from './car-images/service.js';
import { createScanService } from './car-images/scan-service.js';
import { createImageLimiter } from './middleware/image-rate-limit.js';
import { imageScanEventsRouter } from './routes/image-scan-events.js';

export interface BootstrapOptions {
  lambda?: boolean;
}

export async function bootstrapApplication(
  environment: NodeJS.ProcessEnv | Record<string, string>,
  options: BootstrapOptions = {},
) {
  const config = parseEnv(environment);
  const databaseConfig = parseDatabaseEnv(environment);
  const authConfig = parseAuthEnv(
    environment,
    config.NODE_ENV === 'production',
    config.CLIENT_ORIGIN,
  );
  const paymentConfig = parsePaymentEnv(environment);
  const imageConfig = parseImageConfig(
    imageEnvironment(environment as NodeJS.ProcessEnv),
  );
  const logger = createLogger(config);
  const context = createMongooseContext(
    databaseConfig,
    options.lambda
      ? {
          maxPoolSize: 2,
          serverSelectionTimeoutMS: 7_000,
          connectTimeoutMS: 5_000,
        }
      : {},
  );
  const models = createAuthModels(context.connection);
  const carModels = { cars: createCarModel(context.connection) };
  const bookingModels = {
    bookings: createBookingModel(context.connection),
    occupancies: createBookingOccupancyModel(context.connection),
  };
  const paymentModels = {
    payments: createPaymentModel(context.connection),
    events: createPaymentEventModel(context.connection),
  };
  const imageModels = {
    images: createCarImageModel(context.connection),
    sets: createCarImageSetModel(context.connection),
    events: createCarImageScanEventModel(context.connection),
  };
  Object.assign(bookingModels, { payments: paymentModels.payments });
  const repo = createAuthRepository(models);
  const passwords = await createPasswordService();
  const tokens = createTokenService(authConfig);
  const events = createAuthEvents((event) =>
    logger.info(event, 'Authentication event'),
  );
  const authorizationEvents = createAuthorizationEvents((event) =>
    logger.info(event, 'Authorization event'),
  );
  const carEvents = createCarEvents((event) =>
    logger.info(event, 'Car inventory event'),
  );
  const carRepository = createCarRepository(carModels.cars);
  const bookingRepository = createBookingRepository(bookingModels);
  const paymentRepository = createPaymentRepository(paymentModels);
  const paymentEvents = createPaymentEvents((event) =>
    logger.info(event, 'Payment event'),
  );
  const paymentProvider = createStripeProvider(paymentConfig.STRIPE_SECRET_KEY);
  const payments = createPaymentService(
    paymentRepository,
    bookingRepository,
    paymentProvider,
    paymentEvents,
    paymentConfig.STRIPE_PUBLISHABLE_KEY,
  );
  const webhook = createWebhookService(paymentRepository, paymentEvents);
  const paymentLimiter = createPaymentLimiter(
    repo,
    authConfig.AUTH_RATE_LIMIT_SECRET,
  );
  const imageRepository = createImageRepository(imageModels);
  const imageEvents = createCarImageEvents((event) =>
    logger.info(event, 'Car image event'),
  );
  const imageStorage = createS3ImageStorage(
    new S3Client({ region: imageConfig.AWS_REGION }),
    imageConfig.CAR_IMAGE_BUCKET,
  );
  const carImages = createCarImageService(
    imageRepository,
    imageStorage,
    createSharpProcessor(),
    imageEvents,
    {
      exists: async (id, active = false) =>
        Boolean(
          active
            ? await carRepository.findPublic(id)
            : await carRepository.findAdmin(id),
        ),
    },
  );
  const scanImages = createScanService(
    imageRepository,
    imageStorage,
    createSharpProcessor(),
    imageEvents,
  );
  const imageLimiter = createImageLimiter(
    repo,
    authConfig.AUTH_RATE_LIMIT_SECRET,
  );
  const bookingEvents = createBookingEvents((event) =>
    logger.info(event, 'Booking event'),
  );
  const cars = createCarService(
    carRepository,
    carEvents,
    () => new Date(),
    {
      hasBlockingBooking: (carId) =>
        bookingRepository.hasBlockingBooking(carId, new Date()),
    },
    { hasLive: (carId) => imageRepository.hasLive(carId) },
  );
  const bookings = createBookingService(
    bookingRepository,
    carRepository,
    bookingEvents,
    () => new Date(),
    (bookingId) =>
      (
        payments as typeof payments & {
          refundForBooking(id: string): Promise<void>;
        }
      ).refundForBooking(bookingId),
  );
  const auth = createAuthService(repo, passwords, tokens, authConfig, events);
  const log = (event: string, state?: string) => {
    const level = /FAILED|EXCEEDED/.test(event) ? 'error' : 'info';
    logger[level]({ event, ...(state ? { state } : {}) }, 'Service lifecycle');
  };
  const database = createDatabaseManager(context.adapter, log);
  const app = createApp(config, () => database.isDatabaseReady(), {
    auth: {
      service: auth,
      repo,
      tokens,
      config: authConfig,
      events,
      production: config.NODE_ENV === 'production',
      origin: config.CLIENT_ORIGIN,
    },
    authorizationEvents,
    cars,
    bookings,
    payments,
    paymentLimiter,
    paymentWebhook: paymentWebhookRouter({
      provider: paymentProvider,
      service: webhook,
      signingSecret: paymentConfig.STRIPE_WEBHOOK_SECRET,
      coarseLimiter: paymentLimiter('webhook', 'ip'),
      invalidLimiter: paymentLimiter('webhookInvalid', 'ip'),
      events: paymentEvents,
    }),
    carImages,
    imageLimiter,
    imageScanEvents: imageScanEventsRouter({
      service: scanImages,
      secret: imageConfig.CAR_IMAGE_EVENT_SECRET,
      limiter: imageLimiter('event'),
    }),
  });
  return { app, config, database, log };
}
