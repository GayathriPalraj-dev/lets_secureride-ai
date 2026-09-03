import { z } from 'zod';
import { mongo } from 'mongoose';
import { checkServerIdentity } from 'node:tls';

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_ORIGIN: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
    }, 'Expected an HTTP origin without a path')
    .default('http://localhost:5173'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});
export type Config = z.infer<typeof schema>;

export function parseEnv(input: Record<string, unknown>): Config {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Report field names only; never include environment values.
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join('.'))),
    ];
    throw new Error('Invalid configuration fields: ' + fields.join(', '));
  }
  return result.data;
}

export interface DatabaseConfig {
  MONGODB_URI: string;
}

// MongoClient construction parses options only: no connect(), DNS, or sockets.
export function parseDatabaseEnv(
  input: Record<string, unknown>,
): DatabaseConfig {
  const value = input.MONGODB_URI;
  const invalid = () => new Error('Invalid configuration fields: MONGODB_URI');
  if (
    typeof value !== 'string' ||
    !value ||
    /\s/.test(value) ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    !/^mongodb(?:\+srv)?:\/\//.test(value) ||
    /USERNAME:PASSWORD@|HOST\.invalid|^replace_later$|[<>]/i.test(value)
  ) {
    throw invalid();
  }
  try {
    const client = new mongo.MongoClient(value);
    const options = client.options;
    if (
      options.dbName !== 'lets_secureride_ai' ||
      options.tlsAllowInvalidCertificates ||
      options.tlsAllowInvalidHostnames ||
      options.tlsInsecure ||
      options.rejectUnauthorized === false ||
      (options.checkServerIdentity !== undefined &&
        options.checkServerIdentity !== checkServerIdentity) ||
      (value.startsWith('mongodb+srv://') && options.tls === false) ||
      (input.NODE_ENV === 'production' && options.tls !== true)
    ) {
      throw invalid();
    }
  } catch {
    throw invalid();
  }
  return { MONGODB_URI: value };
}
