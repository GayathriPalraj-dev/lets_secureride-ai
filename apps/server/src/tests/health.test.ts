import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { parseEnv } from '../config/env.js';

const config = parseEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
describe('health API', () => {
  it('returns HTTP 200 with the complete health contract', async () => {
    const res = await request(createApp(config))
      .get('/api/v1/health')
      .expect(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        service: 'lets-secureride-ai-api',
        status: 'ok',
        environment: 'test',
        timestamp: expect.any(String),
        uptimeSeconds: expect.any(Number),
      },
      requestId: expect.any(String),
    });
    expect(new Date(res.body.data.timestamp).toISOString()).toBe(
      res.body.data.timestamp,
    );
    expect(Number.isFinite(res.body.data.uptimeSeconds)).toBe(true);
    expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
  it('generates a unique request ID and ignores untrusted supplied IDs', async () => {
    const app = createApp(config);
    const first = await request(app)
      .get('/api/v1/health')
      .set('X-Request-ID', 'untrusted');
    const second = await request(app).get('/api/v1/health');
    expect(first.body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(first.headers['x-request-id']).toBe(first.body.requestId);
    expect(second.body.requestId).not.toBe(first.body.requestId);
  });
  it('returns a consistent 404 for unknown API routes', async () => {
    const res = await request(createApp(config))
      .get('/api/v1/missing')
      .expect(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
      requestId: expect.any(String),
    });
  });
  it('exposes CORS headers only for the configured origin', async () => {
    const app = createApp(config);
    const allowed = await request(app)
      .get('/api/v1/health')
      .set('Origin', config.CLIENT_ORIGIN);
    const other = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://untrusted.example');
    expect(allowed.headers['access-control-allow-origin']).toBe(
      config.CLIENT_ORIGIN,
    );
    expect(other.headers['access-control-allow-origin']).not.toBe(
      'https://untrusted.example',
    );
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
  });
  it('returns the API error contract when rate limited', async () => {
    const app = createApp(config);
    for (let i = 0; i < 100; i++)
      await request(app).get('/api/v1/health').expect(200);
    const res = await request(app).get('/api/v1/health').expect(429);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests; try again later',
      },
      requestId: expect.any(String),
    });
  });
});
