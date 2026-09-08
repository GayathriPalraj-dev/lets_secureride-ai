import { createServer } from 'node:http';
import { createApp } from './app.js';
import { imageEnvironment, parseEnv, parseDatabaseEnv } from './config/env.js';
import { createLogger } from './config/logger.js';
import {
  createDatabaseManager,
  createMongooseContext,
} from './config/database.js';
import { createLifecycle } from './lifecycle.js';
import { parseAuthEnv } from './config/auth.js';
import { createAuthModels, createAuthRepository } from './auth/repository.js';
import { verifyAuthIndexes } from './auth/indexes.js';
import { createPasswordService } from './auth/password-service.js';
import { createTokenService } from './auth/token-service.js';
import { createAuthService } from './auth/service.js';
import { createAuthEvents } from './auth/events.js';
import { createAuthorizationEvents } from './authorization/events.js';
import { createCarModel } from './models/car.js';
import { createCarRepository } from './cars/repository.js';
import { createCarService } from './cars/service.js';
import { createCarEvents } from './cars/events.js';
import { verifyCarIndexes } from './cars/indexes.js';
import { createBookingModel } from './models/booking.js';
import { createBookingOccupancyModel } from './models/booking-occupancy.js';
import { createBookingRepository } from './bookings/repository.js';
import { createBookingService } from './bookings/service.js';
import { createBookingEvents } from './bookings/events.js';
import { verifyBookingIndexes } from './bookings/indexes.js';
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
import { verifyPaymentIndexes } from './payments/indexes.js';
import { S3Client } from '@aws-sdk/client-s3';
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
import { verifyCarImageIndexes } from './car-images/indexes.js';

async function main() {
  // Configuration errors are handled at this boundary, never printed as raw exceptions.
  const config = parseEnv({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
    LOG_LEVEL: process.env.LOG_LEVEL,
  });
  let databaseConfig;
  try {
    databaseConfig = parseDatabaseEnv({
      MONGODB_URI: process.env.MONGODB_URI,
      NODE_ENV: config.NODE_ENV,
    });
  } catch {
    createLogger(config).fatal(
      { code: 'INVALID_DATABASE_CONFIG', field: 'MONGODB_URI' },
      'Database configuration is invalid',
    );
    process.exitCode = 1;
    return;
  }
  const logger = createLogger(config);
  let imageConfig;
  try {
    imageConfig = parseImageConfig(imageEnvironment(process.env));
  } catch {
    logger.fatal(
      { code: 'INVALID_IMAGE_CONFIG' },
      'Image configuration is invalid',
    );
    process.exitCode = 1;
    return;
  }
  let paymentConfig;
  try {
    paymentConfig = parsePaymentEnv({
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    });
  } catch {
    logger.fatal(
      { code: 'INVALID_PAYMENT_CONFIG' },
      'Payment configuration is invalid',
    );
    process.exitCode = 1;
    return;
  }
  let authConfig;
  try {
    authConfig = parseAuthEnv(
      {
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
        JWT_ACCESS_KEY_ID: process.env.JWT_ACCESS_KEY_ID,
        JWT_ACCESS_PREVIOUS_SECRET: process.env.JWT_ACCESS_PREVIOUS_SECRET,
        JWT_ACCESS_PREVIOUS_KEY_ID: process.env.JWT_ACCESS_PREVIOUS_KEY_ID,
        JWT_ISSUER: process.env.JWT_ISSUER,
        JWT_AUDIENCE: process.env.JWT_AUDIENCE,
        AUTH_RATE_LIMIT_SECRET: process.env.AUTH_RATE_LIMIT_SECRET,
        AUTH_ACCESS_TTL_SECONDS: process.env.AUTH_ACCESS_TTL_SECONDS,
        AUTH_REFRESH_IDLE_SECONDS: process.env.AUTH_REFRESH_IDLE_SECONDS,
        AUTH_REFRESH_ABSOLUTE_SECONDS:
          process.env.AUTH_REFRESH_ABSOLUTE_SECONDS,
      },
      config.NODE_ENV === 'production',
      config.CLIENT_ORIGIN,
    );
  } catch {
    logger.fatal(
      { code: 'INVALID_AUTH_CONFIG' },
      'Authentication configuration is invalid',
    );
    process.exitCode = 1;
    return;
  }
  const passwords = await createPasswordService();
  const context = createMongooseContext(databaseConfig);
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
  const service = createAuthService(
    repo,
    passwords,
    tokens,
    authConfig,
    events,
  );
  const log = (event: string, state?: string) => {
    const level = /FAILED|EXCEEDED/.test(event) ? 'error' : 'info';
    logger[level]({ event, ...(state ? { state } : {}) }, 'Service lifecycle');
  };
  const database = createDatabaseManager(
    {
      ...context.adapter,
      open: async () => {
        await context.adapter.open();
        await verifyAuthIndexes(models);
        await verifyCarIndexes(carModels);
        await verifyBookingIndexes(bookingModels);
        await verifyPaymentIndexes(paymentModels);
        await verifyCarImageIndexes(imageModels);
      },
    },
    log,
  );
  const server = createServer(
    createApp(config, () => lifecycle.isReady(), {
      auth: {
        service,
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
    }),
  );
  const lifecycle: ReturnType<typeof createLifecycle> = createLifecycle({
    database,
    log,
    http: {
      listen: () =>
        new Promise<void>((resolve, reject) => {
          const onError = () => {
            server.off('listening', onListening);
            reject(new Error('HTTP startup failed'));
          };
          const onListening = () => {
            server.off('error', onError);
            resolve();
          };
          server.once('error', onError);
          server.once('listening', onListening);
          server.listen(config.PORT);
        }),
      close: () =>
        new Promise<void>((resolve, reject) => {
          if (!server.listening) {
            resolve();
            return;
          }
          server.close((error) => {
            if (error) reject(new Error('HTTP close failed'));
            else resolve();
          });
        }),
      forceClose: () => {
        server.closeAllConnections();
        server.close();
      },
    },
    setExitCode: (code) => {
      process.exitCode = code;
    },
    forceExit: (code) => {
      process.exit(code);
    },
    subscribeSignals: (handler) => {
      process.on('SIGINT', handler);
      process.on('SIGTERM', handler);
      return () => {
        process.off('SIGINT', handler);
        process.off('SIGTERM', handler);
      };
    },
  });
  await lifecycle.start();
}

void main().catch(() => {
  createLogger(parseEnv({})).fatal(
    { code: 'STARTUP_FAILED' },
    'Service startup failed',
  );
  process.exitCode = 1;
});
