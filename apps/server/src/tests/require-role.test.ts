import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { requireAnyRole, requireRole } from '../middleware/require-role.js';
import { requestId } from '../middleware/request-id.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { Role } from '@lets-secureride-ai/contracts';

function app(identity?: unknown, events = vi.fn(), next = vi.fn()) {
  const value = express();
  value.use(requestId);
  if (identity !== undefined)
    value.use((req, _res, done) => {
      req.auth = identity as NonNullable<Express.Request['auth']>;
      done();
    });
  value.get('/protected', requireRole('admin', events), (_req, res) => {
    next();
    res.json({ reached: true });
  });
  value.use(errorHandler);
  return { value, events, next };
}
const admin = { userId: 'u', sessionId: 's', role: 'admin' as const };
const customer = { ...admin, role: 'customer' as const };
function anyRole(
  identity?: unknown,
  roles: readonly Role[] = ['customer', 'admin'],
) {
  const value = express();
  value.use(requestId);
  if (identity)
    value.use((req, _res, next) => {
      req.auth = identity as NonNullable<Express.Request['auth']>;
      next();
    });
  value.get('/cars', requireAnyRole(roles), (_req, res) =>
    res.json({ reached: true }),
  );
  value.use(errorHandler);
  return value;
}

describe('requireRole', () => {
  it('returns 401 without authentication', async () => {
    await request(app().value).get('/protected').expect(401);
    await request(anyRole()).get('/cars').expect(401);
  });
  it('fails when ordered before authentication', async () =>
    request(app().value).get('/protected').expect(401));
  it('returns 403 for customer', async () => {
    await request(app(customer).value).get('/protected').expect(403);
    await request(anyRole(admin, ['customer']))
      .get('/cars')
      .expect(403);
  });
  it('allows admin', async () => {
    await request(app(admin).value).get('/protected').expect(200);
    await request(anyRole(customer)).get('/cars').expect(200);
    await request(anyRole(admin)).get('/cars').expect(200);
  });
  it('denies malformed role', async () => {
    await request(app({ ...admin, role: 1 }).value)
      .get('/protected')
      .expect(403);
    await request(anyRole({ ...customer, role: 'owner' }))
      .get('/cars')
      .expect(403);
    await request(anyRole(customer, [])).get('/cars').expect(403);
  });
  it('denies unknown role', async () =>
    request(app({ ...admin, role: 'owner' }).value)
      .get('/protected')
      .expect(403));
  it('does not reach downstream after denial', async () => {
    const fixture = app(customer);
    await request(fixture.value).get('/protected');
    expect(fixture.next).not.toHaveBeenCalled();
  });
  it('returns safe envelope with request ID', async () => {
    const response = await request(app(customer).value).get('/protected');
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });
  it('does not enumerate roles', async () => {
    const response = await request(app(customer).value).get('/protected');
    expect(JSON.stringify(response.body)).not.toContain('admin');
  });
  it('emits only allowlisted event fields', async () => {
    const fixture = app(customer);
    await request(fixture.value).get('/protected');
    expect(Object.keys(fixture.events.mock.calls[0]![0]).sort()).toEqual([
      'currentRole',
      'event',
      'outcome',
      'requestId',
    ]);
  });
});
