import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { parseEnv } from '../config/env.js';
import { requestId } from '../middleware/request-id.js';
import { errorHandler } from '../middleware/error-handler.js';

describe('safe errors', () => {
  it('does not expose raw errors, stack traces, secrets, or paths in production', async () => {
    // Test-only app exercises the real middleware; no production test route exists.
    const app = express();
    app.set('env', 'production');
    app.use(requestId);
    app.get('/failure', () => {
      throw new Error('private-token at C:/internal/server.ts');
    });
    app.use(errorHandler);
    const res = await request(app).get('/failure').expect(500);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      requestId: expect.any(String),
    });
    expect(res.text).not.toMatch(
      /private-token|internal|server\.ts|stack|Error:/,
    );
  });
  it('returns a safe error for malformed JSON', async () => {
    const app = createApp(
      parseEnv({ NODE_ENV: 'production', LOG_LEVEL: 'silent' }),
    );
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
    expect(res.text).not.toContain('broken');
  });
  it('rejects oversized bodies with a consistent envelope', async () => {
    const app = createApp(parseEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }));
    const res = await request(app)
      .post('/api/v1/health')
      .send({ value: 'x'.repeat(17000) })
      .expect(413);
    expect(res.body.error.code).toBe('BODY_TOO_LARGE');
    expect(res.body.success).toBe(false);
    expect(res.body.requestId).toBeTruthy();
  });
});
