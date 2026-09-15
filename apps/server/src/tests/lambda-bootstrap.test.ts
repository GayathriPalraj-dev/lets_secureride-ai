import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  bootstrap: vi.fn(),
  connect: vi.fn(),
}));
vi.mock('../config/runtime-config.js', () => ({
  loadRuntimeConfiguration: mocks.load,
}));
vi.mock('../bootstrap.js', () => ({ bootstrapApplication: mocks.bootstrap }));

describe('Lambda bootstrap', () => {
  beforeEach(async () => {
    vi.resetModules();
    mocks.load.mockReset().mockResolvedValue({});
    mocks.connect.mockReset().mockResolvedValue(undefined);
    mocks.bootstrap.mockReset().mockImplementation(async () => {
      const app = express();
      app.get('/api/v1/health', (_req, res) => res.json({ ok: true }));
      return { app, database: { connectDatabase: mocks.connect } };
    });
    process.env.SECURERIDE_CONFIG_PARAMETER = '/secureride/runtime';
    process.env.EXPECTED_CLIENT_ORIGIN = 'https://demo.cloudfront.net';
  });

  it('reuses configuration, application, adapter and database initialization', async () => {
    const { handler } = await import('../lambda.js');
    const event = {
      version: '2.0',
      routeKey: 'GET /api/v1/health',
      rawPath: '/api/v1/health',
      rawQueryString: '',
      headers: {},
      requestContext: {
        http: {
          method: 'GET',
          path: '/api/v1/health',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'test',
        },
        requestId: 'one',
        routeKey: 'GET /api/v1/health',
        stage: '$default',
        time: '',
        timeEpoch: 0,
      },
      isBase64Encoded: false,
    };
    await handler(event, {});
    await handler(
      {
        ...event,
        requestContext: { ...event.requestContext, requestId: 'two' },
      },
      {},
    );
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.bootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  it('clears a rejected initialization for retry', async () => {
    mocks.load
      .mockRejectedValueOnce(new Error('failure'))
      .mockResolvedValueOnce({});
    const { handler } = await import('../lambda.js');
    const event = {
      version: '2.0',
      routeKey: 'GET /',
      rawPath: '/',
      rawQueryString: '',
      headers: {},
      requestContext: {
        http: {
          method: 'GET',
          path: '/',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'test',
        },
        requestId: 'one',
        routeKey: 'GET /',
        stage: '$default',
        time: '',
        timeEpoch: 0,
      },
      isBase64Encoded: false,
    };
    await expect(handler(event, {})).rejects.toThrow(
      'Lambda initialization failed',
    );
    await expect(handler(event, {})).resolves.toBeDefined();
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
});
