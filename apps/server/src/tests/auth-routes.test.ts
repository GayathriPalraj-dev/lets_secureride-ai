import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { credentials, fixture } from './helpers/auth.js';
function post(f: ReturnType<typeof fixture>, endpoint: string) {
  return request(f.app)
    .post('/api/v1/auth/' + endpoint)
    .set('Origin', f.origin)
    .set('X-CSRF-Protection', '1');
}
describe('authentication HTTP contracts', () => {
  it('registers with 201, safe data and no cookie', async () => {
    const f = fixture();
    const r = await post(f, 'register').send(credentials).expect(201);
    expect(Object.keys(r.body.data.user).sort()).toEqual([
      'email',
      'id',
      'role',
    ]);
    expect(r.headers['set-cookie']).toBeUndefined();
    expect(r.body.requestId).toBe(r.headers['x-request-id']);
  });
  it('rejects normalized duplicate email', async () => {
    const f = fixture();
    await post(f, 'register').send(credentials).expect(201);
    await post(f, 'register')
      .send({ ...credentials, email: ' CUSTOMER@EXAMPLE.INVALID ' })
      .expect(409);
  });
  it.each(['role', 'status', 'authVersion', 'passwordHash', 'unknown'])(
    'rejects injected field %s',
    async (field) => {
      const f = fixture();
      await post(f, 'register')
        .send({ ...credentials, [field]: 'admin' })
        .expect(400);
      expect(f.users.size).toBe(0);
    },
  );
  it.each([
    { email: 'bad', password: 'x' },
    { email: null, password: 42 },
    {},
    { email: ['x'], password: {} },
  ])('rejects invalid registration case %#', async (body) => {
    await post(fixture(), 'register').send(body).expect(400);
  });
  it('logs in and issues access plus HttpOnly cookie', async () => {
    const f = fixture();
    await f.account();
    const r = await post(f, 'login').send(credentials).expect(200);
    expect(r.body.data.tokenType).toBe('Bearer');
    expect(Boolean(r.body.data.accessToken)).toBe(true);
    expect(String(r.headers['set-cookie']).includes('HttpOnly')).toBe(true);
    expect(r.headers['cache-control']).toBe('no-store');
  });
  it('returns authenticated me with no internal fields', async () => {
    const f = fixture();
    const a = await f.account();
    const r = await request(f.app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer ' + a.login.data.accessToken)
      .expect(200);
    expect(Object.keys(r.body.data.user).sort()).toEqual([
      'email',
      'id',
      'role',
    ]);
  });
  it('rejects me without an access token', async () => {
    await request(fixture().app).get('/api/v1/auth/me').expect(401);
  });
  it('rotates a refresh cookie', async () => {
    const f = fixture();
    const a = await f.account();
    const r = await post(f, 'refresh')
      .set('Cookie', 'lsrai-refresh=' + a.login.refreshToken)
      .send({})
      .expect(200);
    expect(Boolean(r.headers['set-cookie'])).toBe(true);
    expect(a.session.rotation).toBe(1);
  });
  it('clears rejected refresh cookies', async () => {
    const f = fixture();
    const r = await post(f, 'refresh').send({}).expect(401);
    expect(String(r.headers['set-cookie']).includes('Max-Age=0')).toBe(true);
  });
  it('logs out without setting headers after response', async () => {
    const f = fixture();
    const a = await f.account();
    const r = await post(f, 'logout')
      .set('Cookie', 'lsrai-refresh=' + a.login.refreshToken)
      .send({})
      .expect(200);
    expect(r.body.data.loggedOut).toBe(true);
    expect(String(r.headers['set-cookie']).includes('Max-Age=0')).toBe(true);
    expect(a.session.revokedAt !== null).toBe(true);
  });
  it('requires access for logout-all', async () => {
    await post(fixture(), 'logout-all').send({}).expect(401);
  });
  it('logs out every session with a valid identity', async () => {
    const f = fixture();
    const a = await f.account();
    await post(f, 'logout-all')
      .set('Authorization', 'Bearer ' + a.login.data.accessToken)
      .send({})
      .expect(200);
    expect(a.user.authVersion).toBe(1);
  });
  it('fails safely on database errors', async () => {
    const f = fixture();
    vi.spyOn(f.repo, 'findUserByEmail').mockRejectedValue(
      new Error('synthetic-sensitive-diagnostic'),
    );
    const r = await post(f, 'login').send(credentials).expect(503);
    expect(r.text.includes('synthetic-sensitive-diagnostic')).toBe(false);
    expect(r.body.requestId).toBeTruthy();
  });
  it('does not claim persisted logout on database failure', async () => {
    const f = fixture();
    const a = await f.account();
    vi.spyOn(f.repo, 'revokeSession').mockRejectedValue(new Error('synthetic'));
    const r = await post(f, 'logout')
      .set('Cookie', 'lsrai-refresh=' + a.login.refreshToken)
      .send({})
      .expect(503);
    expect(String(r.headers['set-cookie']).includes('Max-Age=0')).toBe(true);
  });
  it('preserves liveness and readiness', async () => {
    const f = fixture();
    await request(f.app).get('/api/v1/health').expect(200);
    await request(f.app).get('/api/v1/health/ready').expect(200);
  });
});
