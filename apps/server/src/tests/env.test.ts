import { describe, expect, it } from 'vitest';
import { parseEnv, parseDatabaseEnv } from '../config/env.js';

describe('foundation environment', () => {
  it('starts with development defaults and no future integration variables', () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 5000,
      CLIENT_ORIGIN: 'http://localhost:5173',
      LOG_LEVEL: 'info',
    });
  });
  it('ignores future placeholders', () => {
    expect(
      parseEnv({
        MONGODB_URI: 'replace_later',
        JWT_ACCESS_SECRET: 'replace_later',
      }).PORT,
    ).toBe(5000);
  });
  it('rejects invalid required configuration without reporting values', () => {
    expect(() => parseEnv({ PORT: 'private-invalid-value' })).toThrow(
      'Invalid configuration fields: PORT',
    );
    expect(() =>
      parseEnv({ CLIENT_ORIGIN: 'https://example.com/path' }),
    ).toThrow('CLIENT_ORIGIN');
  });
});

describe('database configuration', () => {
  const database = '/lets_secureride_ai';
  const fixtures = [
    'mongodb://127.0.0.1:27017' + database,
    'mongodb://127.0.0.1:27017,127.0.0.2:27017' + database,
    'mongodb+srv://test.invalid' + database,
    'mongodb://encoded%40user:encoded%23value@127.0.0.1:27017' + database,
    'mongodb://app:strongPasswordPhrase@127.0.0.1:27017' + database,
  ];
  it('accepts standard, multi-host, SRV, and encoded credential syntax without connecting', () => {
    for (const value of fixtures) {
      expect(
        parseDatabaseEnv({ MONGODB_URI: value }).MONGODB_URI === value,
      ).toBe(true);
    }
  });
  it('rejects missing or blank configuration safely', () => {
    for (const value of [undefined, '', ' ']) {
      expect(() => parseDatabaseEnv({ MONGODB_URI: value })).toThrow(
        'Invalid configuration fields: MONGODB_URI',
      );
    }
  });
  it('rejects invalid protocols and malformed connection strings without values in errors', () => {
    const values = [
      'https://test.invalid' + database,
      'file:///tmp/test',
      'mongodb://',
      'mongodb+srv://test.invalid:27017' + database,
      'mongodb://127.0.0.1/other',
      'mongodb://127.0.0.1' + database + '\n',
      'replace_later',
    ];
    for (const value of values) {
      let message = '';
      try {
        parseDatabaseEnv({ MONGODB_URI: value });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message === 'Invalid configuration fields: MONGODB_URI').toBe(
        true,
      );
    }
  });
  it('rejects disabled TLS verification and SRV TLS downgrades', () => {
    for (const option of [
      'tlsAllowInvalidCertificates=true',
      'tlsAllowInvalidHostnames=true',
      'tlsInsecure=true',
    ]) {
      expect(() =>
        parseDatabaseEnv({ MONGODB_URI: fixtures[0] + '?' + option }),
      ).toThrow('MONGODB_URI');
    }
    expect(() =>
      parseDatabaseEnv({ MONGODB_URI: fixtures[2] + '?tls=false' }),
    ).toThrow('MONGODB_URI');
  });
  it('requires TLS in production and ignores future integration placeholders', () => {
    expect(() =>
      parseDatabaseEnv({ MONGODB_URI: fixtures[0], NODE_ENV: 'production' }),
    ).toThrow('MONGODB_URI');
    const value = fixtures[0] + '?tls=true';
    const result = parseDatabaseEnv({
      MONGODB_URI: value,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'replace_later',
    });
    expect(result.MONGODB_URI === value).toBe(true);
  });
  it('has no cached environment between calls', () => {
    parseDatabaseEnv({ MONGODB_URI: fixtures[0] });
    expect(() => parseDatabaseEnv({})).toThrow('MONGODB_URI');
  });
});
