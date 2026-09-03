import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { parseEnv } from '../config/env.js';
import { createDatabaseManager } from '../config/database.js';
import type { DatabaseStatus } from '../config/database.js';

const config = parseEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
describe('readiness API', () => {
  it('returns a typed ready response with a matching request ID', async () => {
    const res = await request(createApp(config, () => true))
      .get('/api/v1/health/ready')
      .expect(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        service: 'lets-secureride-ai-api',
        status: 'ready',
        database: 'connected',
        timestamp: expect.any(String),
      },
      requestId: expect.any(String),
    });
    expect(new Date(res.body.data.timestamp).toISOString()).toBe(
      res.body.data.timestamp,
    );
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
    expect(res.headers['cache-control']).toBe('no-store');
  });
  it.each([
    'disconnected',
    'connecting',
    'disconnecting',
    'error',
    'shutting_down',
  ])('returns a safe unavailable envelope while %s', async (state) => {
    let listener: ((state: DatabaseStatus) => void) | undefined;
    const manager = createDatabaseManager(
      {
        open: async () => {},
        close: async () => {},
        subscribe(callback) {
          listener = callback;
          return () => {
            listener = undefined;
          };
        },
      },
      () => {},
    );
    await manager.connectDatabase();
    if (state === 'shutting_down') await manager.disconnectDatabase();
    else listener?.(state as DatabaseStatus);
    try {
      const res = await request(createApp(config, manager.isDatabaseReady))
        .get('/api/v1/health/ready')
        .expect(503);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'SERVICE_NOT_READY',
          message: 'Service is temporarily unavailable',
        },
        requestId: expect.any(String),
      });
      expect(res.body.requestId).toBe(res.headers['x-request-id']);
      expect(res.headers['cache-control']).toBe('no-store');
    } finally {
      await manager.disconnectDatabase();
    }
    expect(listener).toBeUndefined();
  });
  it('fails closed without exposing dependency exceptions', async () => {
    const res = await request(
      createApp(config, () => {
        throw new Error('synthetic-private-diagnostic');
      }),
    )
      .get('/api/v1/health/ready')
      .expect(503);
    expect(res.text.includes('synthetic-private-diagnostic')).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_NOT_READY');
  });
  it('preserves liveness while the database is unavailable', async () => {
    const res = await request(createApp(config, () => false))
      .get('/api/v1/health')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });
});
