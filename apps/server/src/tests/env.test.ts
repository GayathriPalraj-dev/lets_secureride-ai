import { describe, expect, it } from 'vitest';
import { parseEnv } from '../config/env.js';

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
