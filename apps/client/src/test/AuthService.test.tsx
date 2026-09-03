import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthError, createAuthRequests } from '../services/auth';
import { createAuthSession } from '../auth/session';
const user = {
  id: 'a'.repeat(24),
  email: 'customer@example.invalid',
  role: 'customer' as const,
};
const data = {
  user,
  accessToken: 'synthetic.payload.signature',
  tokenType: 'Bearer' as const,
  expiresIn: 300,
};
function requests() {
  return {
    register: vi.fn(async () => user),
    login: vi.fn(async () => data),
    refresh: vi.fn(async () => data),
    me: vi.fn(async () => user),
    logout: vi.fn(async () => undefined),
  };
}
afterEach(() => vi.restoreAllMocks());
describe('browser authentication transport', () => {
  it('uses Web Locks for cookie mutations when available', async () => {
    const request = vi.fn(
      async (_name: string, operation: () => Promise<unknown>) => operation(),
    );
    vi.stubGlobal('navigator', { locks: { request } });
    await createAuthSession(requests()).restore();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('broadcasts only logout markers and closes its subscription', async () => {
    const sent: unknown[] = [];
    const close = vi.fn();
    class Channel {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      postMessage(value: unknown) {
        sent.push(value);
      }
      close = close;
    }
    vi.stubGlobal('BroadcastChannel', Channel);
    const s = createAuthSession(requests());
    const unsubscribe = s.subscribeLogout(vi.fn());
    await s.logout();
    unsubscribe();
    expect(sent).toEqual(['logout']);
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('does not restore a delayed current-user response after logout', async () => {
    const r = requests();
    let resolve!: (value: typeof user) => void;
    r.me.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const s = createAuthSession(r);
    const restoring = s.restore();
    await vi.waitFor(() => expect(r.me).toHaveBeenCalledTimes(1));
    await s.logout();
    resolve(user);
    expect(await restoring).toBeNull();
  });
  it('refreshes an expired access token before logout-all', async () => {
    const r = requests();
    const s = createAuthSession(r);
    await s.login({ email: user.email, password: 'synthetic' });
    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 400000);
    await s.logout(true);
    expect(r.refresh).toHaveBeenCalledTimes(1);
    expect(r.logout).toHaveBeenCalledTimes(1);
  });
  it('sends credentialed JSON and the CSRF header', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data, requestId: 'r' }),
    });
    vi.stubGlobal('fetch', fetcher);
    await createAuthRequests().login({
      email: user.email,
      password: 'synthetic passphrase',
    });
    const options = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(options.credentials).toBe('include');
    expect(options.cache).toBe('no-store');
    expect(
      (options.headers as Record<string, string>)['X-CSRF-Protection'],
    ).toBe('1');
  });
  it('maps me to the safe user shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { user: { ...user, passwordHash: 'synthetic' } },
          requestId: 'r',
        }),
      }),
    );
    expect(
      Object.keys(await createAuthRequests().me('synthetic')).sort(),
    ).toEqual(['email', 'id', 'role']);
  });
  it.each([400, 401, 409, 429, 503])('sanitizes HTTP %i', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({
          error: { message: 'synthetic-private-diagnostic' },
        }),
      }),
    );
    try {
      await createAuthRequests().refresh();
    } catch (error) {
      expect(error instanceof AuthError).toBe(true);
      expect(String(error).includes('synthetic-private-diagnostic')).toBe(
        false,
      );
    }
  });
  it('sanitizes network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('synthetic-private')),
    );
    await expect(createAuthRequests().refresh()).rejects.toMatchObject({
      status: 503,
    });
  });
  it.each([
    {},
    { success: true, requestId: 'r', data: {} },
    { success: true, requestId: 'r', data: { ...data, expiresIn: 9999 } },
  ])('rejects invalid response case %#', async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => body }),
    );
    await expect(createAuthRequests().refresh()).rejects.toMatchObject({
      status: 503,
    });
  });
  it('single-flights concurrent restoration', async () => {
    const r = requests();
    const s = createAuthSession(r);
    await Promise.all([s.restore(), s.restore()]);
    expect(r.refresh).toHaveBeenCalledTimes(1);
    expect(r.me).toHaveBeenCalledTimes(1);
  });
  it('returns unauthenticated on missing session', async () => {
    const r = requests();
    r.refresh.mockRejectedValue(new AuthError(401, 'missing'));
    expect(await createAuthSession(r).restore()).toBeNull();
  });
  it('preserves transient restoration failure as an error', async () => {
    const r = requests();
    r.refresh.mockRejectedValue(new AuthError(503, 'unavailable'));
    await expect(createAuthSession(r).restore()).rejects.toMatchObject({
      status: 503,
    });
  });
  it('retries me once after an expired access token', async () => {
    const r = requests();
    const s = createAuthSession(r);
    await s.login({ email: user.email, password: 'synthetic' });
    r.me.mockRejectedValueOnce(new AuthError(401, 'expired'));
    expect(await s.me()).toEqual(user);
    expect(r.refresh).toHaveBeenCalledTimes(1);
  });
  it('does not retry a failed login mutation', async () => {
    const r = requests();
    r.login.mockRejectedValue(new AuthError(503, 'failed'));
    await expect(
      createAuthSession(r).login({ email: user.email, password: 'synthetic' }),
    ).rejects.toThrow();
    expect(r.login).toHaveBeenCalledTimes(1);
  });
  it('does not store authentication material in browser storage', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    const s = createAuthSession(requests());
    await s.restore();
    expect(spy).not.toHaveBeenCalled();
  });
  it('invalidates an in-flight refresh on logout', async () => {
    const r = requests();
    let resolve!: (value: typeof data) => void;
    r.refresh.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const s = createAuthSession(r);
    const restoring = s.restore();
    await Promise.resolve();
    const loggingOut = s.logout();
    resolve(data);
    await loggingOut;
    expect(await restoring).toBeNull();
  });
  it('reports failed server revocation', async () => {
    const r = requests();
    r.logout.mockRejectedValue(new AuthError(503, 'failed'));
    const s = createAuthSession(r);
    await s.login({ email: user.email, password: 'synthetic' });
    await expect(s.logout()).rejects.toMatchObject({ status: 503 });
  });
});
