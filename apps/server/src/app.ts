import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import type { ApiError } from '@lets-secureride-ai/contracts';
import type { Config } from './config/env.js';
import { createLogger } from './config/logger.js';
import { requestId } from './middleware/request-id.js';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

export function createApp(config: Config) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(requestId);
  app.use(
    pinoHttp({
      logger: createLogger(config),
      genReqId: (req) => (req as express.Request).requestId,
      // Do not log URLs (which can contain secrets), headers, bodies, or raw errors.
      serializers: {
        req: (req) => ({ id: req.id, method: req.method }),
        res: (res) => ({ statusCode: res.statusCode }),
        err: () => ({ message: 'Request failed' }),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({ origin: config.CLIENT_ORIGIN, exposedHeaders: ['X-Request-ID'] }),
  );
  app.use(compression());
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req, res) => {
        const body: ApiError = {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests; try again later',
          },
          requestId: req.requestId,
        };
        res.status(429).json(body);
      },
    }),
  );
  app.use(express.json({ limit: '16kb' }));
  app.use(
    express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 100 }),
  );
  app.use('/api/v1', apiRouter(config));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
