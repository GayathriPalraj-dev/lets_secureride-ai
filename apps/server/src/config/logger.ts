import { pino } from 'pino';
import type { Config } from './env.js';

export function createLogger(config: Config) {
  return pino({
    level: config.LOG_LEVEL,
    base: { service: 'lets-secureride-ai-api' },
    redact: [
      'req.headers',
      'req.body',
      'res.headers',
      'authorization',
      'password',
      'token',
      'MONGODB_URI',
      'uri',
      'config',
      'databaseConfig',
      'err',
      'error',
    ],
  });
}
