import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { fixture, credentials } from './helpers/auth.js';
import { createAuthEvents } from '../auth/events.js';
import { createLogger } from '../config/logger.js';
import { parseEnv } from '../config/env.js';
describe('auth transport and abuse controls', () => {
  it.each(['register', 'login', 'refresh', 'logout', 'logout-all'])(
    'rejects missing origin on %s',
    async (endpoint) => {
      await request(fixture().app)
        .post('/api/v1/auth/' + endpoint)
        .set('X-CSRF-Protection', '1')
        .send({})
        .expect(403);
    },
  );
  it.each([
    'null',
    'https://untrusted.example',
    'http://localhost:5173.evil.invalid',
  ])('rejects untrusted origin case %#', async (origin) => {
    await request(fixture().app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .send({})
      .expect(403);
  });
  it('requires the CSRF custom header', async () => {
    const f = fixture();
    await request(f.app)
      .post('/api/v1/auth/login')
      .set('Origin', f.origin)
      .send(credentials)
      .expect(403);
  });
  it('rejects cross-site fetch metadata', async () => {
    const f = fixture();
    await request(f.app)
      .post('/api/v1/auth/login')
      .set('Origin', f.origin)
      .set('X-CSRF-Protection', '1')
      .set('Sec-Fetch-Site', 'cross-site')
      .send(credentials)
      .expect(403);
  });
  it('rejects form content types', async () => {
    const f = fixture();
    await request(f.app)
      .post('/api/v1/auth/login')
      .set('Origin', f.origin)
      .set('X-CSRF-Protection', '1')
      .type('form')
      .send(credentials)
      .expect(415);
  });
  it('permits credentialed trusted preflight', async () => {
    const f = fixture();
    const r = await request(f.app)
      .options('/api/v1/auth/login')
      .set('Origin', f.origin)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(r.headers['access-control-allow-origin']).toBe(f.origin);
    expect(r.headers['access-control-allow-credentials']).toBe('true');
  });
  it('does not grant CORS access to other origins', async () => {
    const r = await request(fixture().app)
      .get('/api/v1/health')
      .set('Origin', 'https://untrusted.example');
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });
  it.each([false, true])(
    'sets correct cookie security in production=%s',
    async (production) => {
      const f = fixture(production);
      await f.account();
      const r = await request(f.app)
        .post('/api/v1/auth/login')
        .set('Origin', f.origin)
        .set('X-CSRF-Protection', '1')
        .send(credentials);
      const cookie = String(r.headers['set-cookie']);
      expect(cookie.includes('HttpOnly')).toBe(true);
      expect(cookie.includes('SameSite=Lax')).toBe(true);
      expect(cookie.includes('Path=/')).toBe(true);
      expect(cookie.includes('Secure')).toBe(production);
      expect(cookie.includes('__Host-')).toBe(production);
      expect(cookie.includes('Domain=')).toBe(false);
    },
  );
  it('rejects duplicate refresh cookie names', async () => {
    const f = fixture();
    await request(f.app)
      .post('/api/v1/auth/refresh')
      .set('Origin', f.origin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', 'lsrai-refresh=x; lsrai-refresh=y')
      .send({})
      .expect(401);
  });
  it('enforces the shared normalized-account limit', async () => {
    const f = fixture();
    for (let i = 0; i < 10; i++)
      await request(f.app)
        .post('/api/v1/auth/login')
        .set('Origin', f.origin)
        .set('X-CSRF-Protection', '1')
        .send(credentials)
        .expect(401);
    const r = await request(f.app)
      .post('/api/v1/auth/login')
      .set('Origin', f.origin)
      .set('X-CSRF-Protection', '1')
      .send(credentials)
      .expect(429);
    expect(r.headers['retry-after']).toBeTruthy();
    expect(r.body.requestId).toBeTruthy();
    expect(
      [...f.limits.keys()].every((key) => /^[a-f0-9]{64}$/.test(key)),
    ).toBe(true);
  });
  it('fails closed when shared limits fail', async () => {
    const f = fixture();
    vi.spyOn(f.repo, 'hitLimit').mockRejectedValue(
      new Error('synthetic-sensitive'),
    );
    const r = await request(f.app)
      .post('/api/v1/auth/login')
      .set('Origin', f.origin)
      .set('X-CSRF-Protection', '1')
      .send(credentials)
      .expect(503);
    expect(r.text.includes('synthetic-sensitive')).toBe(false);
  });
  it('does not cache malformed auth requests', async () => {
    const r = await request(fixture().app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(r.headers['cache-control']).toBe('no-store');
  });
  it('restricts event output to an allowlist', () => {
    const write = vi.fn();
    const emit = createAuthEvents(write);
    const data = {
      event: 'AUTH_LOGIN_FAILED' as const,
      requestId: 'request',
      outcome: 'failure' as const,
      password: 'synthetic-sensitive',
    };
    emit(data);
    expect(
      JSON.stringify(write.mock.calls).includes('synthetic-sensitive'),
    ).toBe(false);
  });
  it('does not propagate event-sink failures', () => {
    const emit = createAuthEvents(() => {
      throw new Error('synthetic');
    });
    expect(() =>
      emit({ event: 'AUTH_LOGOUT', requestId: 'r', outcome: 'success' }),
    ).not.toThrow();
  });
  it('configures credential redaction on logger output', () => {
    const lines: string[] = [];
    const logger = createLogger(parseEnv({ LOG_LEVEL: 'info' }), {
      write: (line) => {
        lines.push(line);
      },
    });
    logger.info(
      {
        password: 'synthetic-sensitive',
        refreshToken: 'synthetic-sensitive',
        req: { headers: { cookie: 'synthetic-sensitive' } },
      },
      'test',
    );
    expect(lines.length).toBe(1);
    expect(lines.join('').includes('synthetic-sensitive')).toBe(false);
  });
});
