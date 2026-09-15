import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { z } from 'zod';
import { parseAuthEnv } from './auth.js';
import { parseEnv, parseDatabaseEnv } from './env.js';
import { parseImageConfig } from './images.js';
import { parsePaymentEnv } from './payments.js';

const short = z.string().min(1).max(200);
const runtimeSchema = z
  .object({
    NODE_ENV: z.literal('production'),
    PORT: z
      .string()
      .regex(/^\d{1,5}$/)
      .max(5),
    CLIENT_ORIGIN: z.string().url().max(300),
    LOG_LEVEL: z.enum([
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
      'silent',
    ]),
    TRUST_PROXY: z.enum(['false', 'loopback']),
    MONGODB_URI: z.string().min(20).max(2048),
    JWT_ACCESS_SECRET: z.string().min(44).max(172),
    JWT_ACCESS_KEY_ID: z.string().min(1).max(64),
    JWT_ACCESS_PREVIOUS_SECRET: z.string().min(44).max(172).optional(),
    JWT_ACCESS_PREVIOUS_KEY_ID: z.string().min(1).max(64).optional(),
    JWT_ISSUER: short,
    JWT_AUDIENCE: short,
    AUTH_RATE_LIMIT_SECRET: z.string().min(44).max(172),
    AUTH_ACCESS_TTL_SECONDS: z.string().regex(/^\d+$/).max(10),
    AUTH_REFRESH_IDLE_SECONDS: z.string().regex(/^\d+$/).max(10),
    AUTH_REFRESH_ABSOLUTE_SECONDS: z.string().regex(/^\d+$/).max(10),
    STRIPE_SECRET_KEY: z.string().min(24).max(256),
    STRIPE_PUBLISHABLE_KEY: z.string().min(24).max(256),
    STRIPE_WEBHOOK_SECRET: z.string().min(22).max(256),
    AWS_REGION: z
      .string()
      .regex(/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/)
      .max(32),
    CAR_IMAGE_BUCKET: z.string().min(3).max(63),
    CAR_IMAGE_EVENT_SECRET: z.string().min(32).max(256),
  })
  .strict();

export type RuntimeEnvironment = z.infer<typeof runtimeSchema>;
export interface ParameterReader {
  send(
    command: GetParameterCommand,
  ): Promise<{ Parameter?: { Value?: string } }>;
}

let cached: Promise<RuntimeEnvironment> | undefined;

export function validateRuntimeConfiguration(
  raw: string,
  expectedOrigin: string,
): RuntimeEnvironment {
  if (Buffer.byteLength(raw, 'utf8') > 3_800)
    throw new Error('Runtime configuration exceeds the 3800-byte safety limit');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('Runtime configuration is invalid');
  }
  const result = runtimeSchema.safeParse(json);
  if (!result.success) throw new Error('Runtime configuration is invalid');
  const value = result.data;
  if (
    !expectedOrigin.startsWith('https://') ||
    value.CLIENT_ORIGIN !== expectedOrigin
  )
    throw new Error('Runtime configuration origin is invalid');
  parseEnv(value);
  parseDatabaseEnv(value);
  parseAuthEnv(value, true, value.CLIENT_ORIGIN);
  parsePaymentEnv(value);
  parseImageConfig(value);
  return value;
}

export function loadRuntimeConfiguration(
  parameterName: string,
  expectedOrigin: string,
  reader: ParameterReader = new SSMClient({}),
): Promise<RuntimeEnvironment> {
  if (!parameterName || parameterName.length > 2048)
    return Promise.reject(new Error('Runtime parameter name is invalid'));
  cached ??= reader
    .send(
      new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
    )
    .then((response) => {
      const raw = response.Parameter?.Value;
      if (typeof raw !== 'string')
        throw new Error('Runtime configuration is unavailable');
      return validateRuntimeConfiguration(raw, expectedOrigin);
    })
    .catch(() => {
      cached = undefined;
      throw new Error('Runtime configuration could not be loaded');
    });
  return cached;
}

export function resetRuntimeConfigurationCacheForTests() {
  cached = undefined;
}
