import { describe, expect, it } from 'vitest';
import { parseAuthEnv } from '../config/auth.js';
import { authConfig } from './helpers/auth.js';
describe('authentication configuration', () => {
  it('accepts independent keys and bounded defaults', () => {
    expect(authConfig().AUTH_ACCESS_TTL_SECONDS).toBe(300);
  });
  it.each([
    'JWT_ACCESS_SECRET',
    'JWT_ACCESS_KEY_ID',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
    'AUTH_RATE_LIMIT_SECRET',
  ])('requires %s', (field) => {
    const input: Record<string, unknown> = { ...authConfig() };
    delete input[field];
    expect(() => parseAuthEnv(input)).toThrow(
      'Invalid authentication configuration fields:',
    );
  });
  it.each(['placeholder', '<GENERATE_PRIVATELY>', 'abc', 'a'.repeat(2048)])(
    'rejects invalid key case %#',
    (value) => {
      expect(() =>
        parseAuthEnv({ ...authConfig(), JWT_ACCESS_SECRET: value }),
      ).toThrow('JWT_ACCESS_SECRET');
    },
  );
  it.each([0, 59, 901, 1.5, 'invalid'])(
    'rejects access lifetime case %#',
    (value) => {
      expect(() =>
        parseAuthEnv({ ...authConfig(), AUTH_ACCESS_TTL_SECONDS: value }),
      ).toThrow('AUTH_ACCESS_TTL_SECONDS');
    },
  );
  it('requires both previous-key settings', () => {
    expect(() =>
      parseAuthEnv({ ...authConfig(), JWT_ACCESS_PREVIOUS_KEY_ID: 'old' }),
    ).toThrow();
  });
  it('rejects shared limiter and signing keys', () => {
    const c = authConfig();
    expect(() =>
      parseAuthEnv({ ...c, AUTH_RATE_LIMIT_SECRET: c.JWT_ACCESS_SECRET }),
    ).toThrow();
  });
  it('rejects idle expiry beyond absolute expiry', () => {
    expect(() =>
      parseAuthEnv({ ...authConfig(), AUTH_REFRESH_ABSOLUTE_SECONDS: 3600 }),
    ).toThrow();
  });
  it('requires HTTPS in production', () => {
    expect(() =>
      parseAuthEnv(authConfig(), true, 'http://localhost:5173'),
    ).toThrow('CLIENT_ORIGIN');
  });
  it('does not echo invalid configuration values', () => {
    const sentinel = 'synthetic-sensitive-input';
    try {
      parseAuthEnv({ ...authConfig(), JWT_ACCESS_SECRET: sentinel });
    } catch (error) {
      expect(String(error).includes(sentinel)).toBe(false);
    }
  });
});
