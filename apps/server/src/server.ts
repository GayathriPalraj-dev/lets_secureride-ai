import { createServer } from 'node:http';
import { bootstrapApplication } from './bootstrap.js';
import { createLogger } from './config/logger.js';
import { parseEnv } from './config/env.js';
import { createLifecycle } from './lifecycle.js';

async function main() {
  const runtime = await bootstrapApplication(process.env);
  const server = createServer(runtime.app);
  const lifecycle = createLifecycle({
    database: runtime.database,
    log: runtime.log,
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
          server.listen(runtime.config.PORT);
        }),
      close: () =>
        new Promise<void>((resolve, reject) => {
          if (!server.listening) return resolve();
          server.close((error) =>
            error ? reject(new Error('HTTP close failed')) : resolve(),
          );
        }),
      forceClose: () => {
        server.closeAllConnections();
        server.close();
      },
    },
    setExitCode: (code) => {
      process.exitCode = code;
    },
    forceExit: (code) => process.exit(code),
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
