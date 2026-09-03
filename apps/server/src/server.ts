import { createServer } from 'node:http';
import { createApp } from './app.js';
import { parseEnv, parseDatabaseEnv } from './config/env.js';
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
  const repo = createAuthRepository(models);
  const tokens = createTokenService(authConfig);
  const events = createAuthEvents((event) =>
    logger.info(event, 'Authentication event'),
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
      },
    },
    log,
  );
  const server = createServer(
    createApp(config, () => lifecycle.isReady(), {
      service,
      repo,
      tokens,
      config: authConfig,
      events,
      production: config.NODE_ENV === 'production',
      origin: config.CLIENT_ORIGIN,
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
