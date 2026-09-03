import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createLogger } from './config/logger.js';

// Reads only current foundation variables, never future secret placeholders.
const config = parseEnv({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  LOG_LEVEL: process.env.LOG_LEVEL,
});
const logger = createLogger(config);
const server = createApp(config).listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'lets-secureride-ai-api listening');
});
server.on('error', () => {
  logger.fatal('HTTP server failed to start');
  process.exitCode = 1;
});
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');
  const timer = setTimeout(() => {
    logger.error('Graceful shutdown deadline exceeded');
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  timer.unref();
  server.close((error) => {
    clearTimeout(timer);
    process.exitCode = error ? 1 : 0;
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
