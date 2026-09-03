import { createServer } from 'node:http';
import { createApp } from './app.js';
import { parseEnv, parseDatabaseEnv } from './config/env.js';
import { createLogger } from './config/logger.js';
import {
  createDatabaseManager,
  createMongooseAdapter,
} from './config/database.js';
import { createLifecycle } from './lifecycle.js';

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
  const log = (event: string, state?: string) => {
    const level = /FAILED|EXCEEDED/.test(event) ? 'error' : 'info';
    logger[level]({ event, ...(state ? { state } : {}) }, 'Service lifecycle');
  };
  const database = createDatabaseManager(
    createMongooseAdapter(databaseConfig),
    log,
  );
  const server = createServer(createApp(config, () => lifecycle.isReady()));
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
