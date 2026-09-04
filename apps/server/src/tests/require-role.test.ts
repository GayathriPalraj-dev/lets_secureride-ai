import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { requireRole } from '../middleware/require-role.js';
import { requestId } from '../middleware/request-id.js';
import { errorHandler } from '../middleware/error-handler.js';

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

describe('requireRole', () => {
  it('returns 401 without authentication', async () =>
    request(app().value).get('/protected').expect(401));
  it('fails when ordered before authentication', async () =>
    request(app().value).get('/protected').expect(401));
  it('returns 403 for customer', async () =>
    request(app(customer).value).get('/protected').expect(403));
  it('allows admin', async () =>
    request(app(admin).value).get('/protected').expect(200));
  it('denies malformed role', async () =>
    request(app({ ...admin, role: 1 }).value)
      .get('/protected')
      .expect(403));
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
