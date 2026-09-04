import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { fixture } from './helpers/auth.js';

async function authenticated(role: 'customer' | 'admin') {
  const f = fixture();
  const account = await f.account();
  account.user.role = role;
  return { f, account };
}
function get(app: ReturnType<typeof fixture>['app'], token?: string) {
  const result = request(app).get('/api/v1/admin/access');
  return token ? result.set('Authorization', 'Bearer ' + token) : result;
}

describe('admin access route', () => {
  it('is mounted at the exact path', async () =>
    get(fixture().app).expect(401));
  it('returns 401 anonymously', async () => get(fixture().app).expect(401));
  it('returns 403 for a customer', async () => {
    const { f, account } = await authenticated('customer');
    await get(f.app, account.login.data.accessToken).expect(403);
  });
  it('returns 200 for current admin', async () => {
    const { f, account } = await authenticated('admin');
    await get(f.app, account.login.data.accessToken).expect(200);
  });
  it('returns only the approved data', async () => {
    const { f, account } = await authenticated('admin');
    const response = await get(f.app, account.login.data.accessToken);
    expect(response.body.data).toEqual({ authorized: true });
  });
  it('matches body and header request IDs', async () => {
    const response = await get(fixture().app);
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });
  it('authenticates before authorization', async () => {
    const f = fixture();
    const spy = vi.spyOn(f.service, 'authenticate');
    await get(f.app).expect(401);
    expect(spy).not.toHaveBeenCalled();
  });
  it('does not return handler content after denial', async () => {
    const { f, account } = await authenticated('customer');
    const response = await get(f.app, account.login.data.accessToken);
    expect(response.body.data).toBeUndefined();
  });
  it('rejects revoked sessions', async () => {
    const { f, account } = await authenticated('admin');
    account.session.revokedAt = new Date();
    await get(f.app, account.login.data.accessToken).expect(401);
  });
  it('fails closed for malformed current role', async () => {
    const { f, account } = await authenticated('admin');
    vi.spyOn(f.service, 'authenticate').mockResolvedValueOnce({
      userId: account.user.id,
      sessionId: account.session.id,
      role: 'owner',
    } as never);
    await get(f.app, account.login.data.accessToken).expect(403);
  });
  it('sanitizes authentication repository failure', async () => {
    const f = fixture();
    vi.spyOn(f.service, 'authenticate').mockRejectedValueOnce(
      new Error('private-database-marker'),
    );
    const response = await get(f.app, 'synthetic.payload.signature').expect(
      503,
    );
    expect(JSON.stringify(response.body)).not.toContain(
      'private-database-marker',
    );
  });
  it('sets no-store for success and failure', async () => {
    const denied = await get(fixture().app);
    const { f, account } = await authenticated('admin');
    const allowed = await get(f.app, account.login.data.accessToken);
    expect(denied.headers['cache-control']).toBe('no-store');
    expect(allowed.headers['cache-control']).toBe('no-store');
  });
  it('omits sensitive fields from bodies and events', async () => {
    const { f, account } = await authenticated('customer');
    const response = await get(f.app, account.login.data.accessToken);
    const output = JSON.stringify([response.body, f.events.mock.calls]);
    for (const marker of [
      'accessToken',
      'passwordHash',
      'sessionId',
      'MONGODB_URI',
    ])
      expect(output).not.toContain(marker);
  });
});
