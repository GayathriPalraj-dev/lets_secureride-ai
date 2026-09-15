import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadRuntimeConfiguration,
  resetRuntimeConfigurationCacheForTests,
  validateRuntimeConfiguration,
} from '../config/runtime-config.js';

const secret = Buffer.alloc(32, 7).toString('base64');
const valid = {
  NODE_ENV: 'production',
  PORT: '5000',
  CLIENT_ORIGIN: 'https://demo.cloudfront.net',
  LOG_LEVEL: 'info',
  TRUST_PROXY: 'false',
  MONGODB_URI:
    'mongodb+srv://user:password@example.mongodb.net/lets_secureride_ai?tls=true',
  JWT_ACCESS_SECRET: secret,
  JWT_ACCESS_KEY_ID: 'current',
  JWT_ISSUER: 'secureride',
  JWT_AUDIENCE: 'secureride-client',
  AUTH_RATE_LIMIT_SECRET: Buffer.alloc(32, 8).toString('base64'),
  AUTH_ACCESS_TTL_SECONDS: '300',
  AUTH_REFRESH_IDLE_SECONDS: '604800',
  AUTH_REFRESH_ABSOLUTE_SECONDS: '2592000',
  STRIPE_SECRET_KEY: `sk_test_${'a'.repeat(20)}`,
  STRIPE_PUBLISHABLE_KEY: `pk_test_${'b'.repeat(20)}`,
  STRIPE_WEBHOOK_SECRET: `whsec_${'c'.repeat(20)}`,
  AWS_REGION: 'ap-south-1',
  CAR_IMAGE_BUCKET: 'secureride-demo-media',
  CAR_IMAGE_EVENT_SECRET: 'd'.repeat(32),
};

describe('Lambda runtime configuration', () => {
  beforeEach(() => resetRuntimeConfigurationCacheForTests());

  it('strictly validates a bounded production configuration', () => {
    expect(
      validateRuntimeConfiguration(JSON.stringify(valid), valid.CLIENT_ORIGIN),
    ).toEqual(valid);
    expect(() =>
      validateRuntimeConfiguration(
        JSON.stringify({ ...valid, unexpected: true }),
        valid.CLIENT_ORIGIN,
      ),
    ).toThrow();
    expect(() =>
      validateRuntimeConfiguration(
        JSON.stringify(valid),
        'https://other.cloudfront.net',
      ),
    ).toThrow();
    expect(() =>
      validateRuntimeConfiguration('x'.repeat(3801), valid.CLIENT_ORIGIN),
    ).toThrow(/3800-byte/);
  });

  it('decrypts and caches one exact parameter read', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ Parameter: { Value: JSON.stringify(valid) } });
    await loadRuntimeConfiguration('/secureride/runtime', valid.CLIENT_ORIGIN, {
      send,
    });
    await loadRuntimeConfiguration('/secureride/runtime', valid.CLIENT_ORIGIN, {
      send,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].input).toEqual({
      Name: '/secureride/runtime',
      WithDecryption: true,
    });
  });

  it('clears rejected reads so a later invocation retries', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('secret-bearing SDK failure'))
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify(valid) } });
    await expect(
      loadRuntimeConfiguration('/secureride/runtime', valid.CLIENT_ORIGIN, {
        send,
      }),
    ).rejects.toThrow('could not be loaded');
    await expect(
      loadRuntimeConfiguration('/secureride/runtime', valid.CLIENT_ORIGIN, {
        send,
      }),
    ).resolves.toEqual(valid);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
