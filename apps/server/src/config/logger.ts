import { pino, type DestinationStream } from 'pino';
import type { Config } from './env.js';

export function createLogger(config: Config, destination?: DestinationStream) {
  return pino(
    {
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
        'authConfig',
        'cookie',
        'cookies',
        'accessToken',
        'refreshToken',
        'passwordHash',
        'currentHash',
        'usedHashes',
        'JWT_ACCESS_SECRET',
        'JWT_ACCESS_PREVIOUS_SECRET',
        'AUTH_RATE_LIMIT_SECRET',
        'err',
        'error',
      ],
    },
    destination,
  );
}
