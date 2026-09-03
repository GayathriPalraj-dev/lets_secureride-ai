import { describe, expect, it, vi } from 'vitest';
import { credentials, fixture } from './helpers/auth.js';
describe('authentication services', () => {
  it('registers only a customer with a safe DTO', async () => {
    const f = fixture();
    const result = await f.service.register(
      credentials.email,
      credentials.password,
      'r',
    );
    expect(result.user.role).toBe('customer');
    expect(Object.keys(result.user).sort()).toEqual(['email', 'id', 'role']);
    expect(f.sessions.size).toBe(0);
  });
  it('rejects duplicate email', async () => {
    const f = fixture();
    await f.account();
    await expect(
      f.service.register(credentials.email, credentials.password, 'r'),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('uses the password service before persistence', async () => {
    const f = fixture();
    const a = await f.account();
    expect(a.user.passwordHash === credentials.password).toBe(false);
    expect(f.passwords.hash).toHaveBeenCalled();
  });
  it('creates separate device sessions', async () => {
    const f = fixture();
    await f.account();
    await f.service.login(credentials.email, credentials.password, 'r');
    expect(f.sessions.size).toBe(2);
  });
  it.each(['unknown', 'wrong', 'disabled'])(
    'returns identical login failure for %s',
    async (kind) => {
      const f = fixture();
      const a = await f.account();
      if (kind === 'disabled') a.user.status = 'disabled';
      await expect(
        f.service.login(
          kind === 'unknown' ? 'unknown@example.invalid' : credentials.email,
          kind === 'wrong' ? 'incorrect' : credentials.password,
          'r',
        ),
      ).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        publicMessage: 'Email or password is incorrect',
      });
      if (kind === 'unknown')
        expect(f.passwords.dummyVerify).toHaveBeenCalled();
    },
  );
  it('rotates refresh material and rejects the consumed token', async () => {
    const f = fixture();
    const a = await f.account();
    const rotated = await f.service.refresh(a.login.refreshToken, 'r');
    expect(rotated.refreshToken !== a.login.refreshToken).toBe(true);
    expect(a.session.rotation).toBe(1);
    await expect(
      f.service.refresh(a.login.refreshToken, 'r'),
    ).rejects.toMatchObject({ status: 401 });
    expect(a.session.revokedAt !== null).toBe(true);
    await expect(
      f.service.refresh(rotated.refreshToken, 'r'),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('does not persist a raw refresh token', async () => {
    const f = fixture();
    const a = await f.account();
    expect(
      JSON.stringify([...f.sessions.values()]).includes(a.login.refreshToken),
    ).toBe(false);
  });
  it('does not revoke for a guessed secret', async () => {
    const f = fixture();
    const a = await f.account();
    const other = f.tokens.refresh(a.session.id);
    await expect(f.service.refresh(other.token, 'r')).rejects.toMatchObject({
      status: 401,
    });
    expect(a.session.revokedAt).toBeNull();
  });
  it.each(['idle', 'absolute', 'revoked', 'version', 'disabled', 'limit'])(
    'rejects refresh for %s',
    async (kind) => {
      const f = fixture();
      const a = await f.account();
      if (kind === 'idle') a.session.idleExpiresAt = f.now();
      if (kind === 'absolute') a.session.absoluteExpiresAt = f.now();
      if (kind === 'revoked') a.session.revokedAt = f.now();
      if (kind === 'version') a.user.authVersion++;
      if (kind === 'disabled') a.user.status = 'disabled';
      if (kind === 'limit') a.session.rotation = 10000;
      await expect(
        f.service.refresh(a.login.refreshToken, 'r'),
      ).rejects.toMatchObject({ status: 401 });
    },
  );
  it('caps refreshed idle expiry at absolute expiry', async () => {
    const f = fixture();
    const a = await f.account();
    a.session.absoluteExpiresAt = new Date(f.now().getTime() + 100000);
    const result = await f.service.refresh(a.login.refreshToken, 'r');
    expect(result.expiresAt.getTime()).toBe(
      a.session.absoluteExpiresAt.getTime(),
    );
  });
  it('allows only one concurrent consumption and revokes on reuse', async () => {
    const f = fixture();
    const a = await f.account();
    const results = await Promise.allSettled([
      f.service.refresh(a.login.refreshToken, 'r'),
      f.service.refresh(a.login.refreshToken, 'r'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect(a.session.revokedAt !== null).toBe(true);
  });
  it('revokes current-session access immediately', async () => {
    const f = fixture();
    const a = await f.account();
    await f.service.logout(a.login.refreshToken, 'r');
    await expect(
      f.service.authenticate(a.login.data.accessToken),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('logout is idempotent for missing material', async () => {
    const f = fixture();
    expect(await f.service.logout(undefined, 'r')).toEqual({ loggedOut: true });
  });
  it('logout accepts a recognized consumed token', async () => {
    const f = fixture();
    const a = await f.account();
    await f.service.refresh(a.login.refreshToken, 'r');
    await f.service.logout(a.login.refreshToken, 'r');
    expect(a.session.revokedAt !== null).toBe(true);
  });
  it('logout-all invalidates every device', async () => {
    const f = fixture();
    const a = await f.account();
    const second = await f.service.login(
      credentials.email,
      credentials.password,
      'r',
    );
    await f.service.logoutAll(
      await f.service.authenticate(a.login.data.accessToken),
      'r',
    );
    for (const token of [a.login.data.accessToken, second.data.accessToken])
      await expect(f.service.authenticate(token)).rejects.toMatchObject({
        status: 401,
      });
  });
  it('epoch remains authoritative when cleanup fails', async () => {
    const f = fixture();
    const a = await f.account();
    vi.spyOn(f.repo, 'revokeAll').mockRejectedValueOnce(new Error('synthetic'));
    await f.service.logoutAll(
      await f.service.authenticate(a.login.data.accessToken),
      'r',
    );
    await expect(
      f.service.authenticate(a.login.data.accessToken),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('rejects a session created concurrently with epoch invalidation', async () => {
    const f = fixture();
    await f.account();
    vi.spyOn(f.repo, 'createSession').mockImplementation(async (s) => {
      f.sessions.set(s.id, structuredClone(s));
      f.users.get(s.userId)!.authVersion++;
    });
    await expect(
      f.service.login(credentials.email, credentials.password, 'r'),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('gets role from current database identity', async () => {
    const f = fixture();
    const a = await f.account();
    a.user.role = 'admin';
    expect((await f.service.authenticate(a.login.data.accessToken)).role).toBe(
      'admin',
    );
  });
  it('returns safe current-user data', async () => {
    const f = fixture();
    const a = await f.account();
    const result = await f.service.me(
      await f.service.authenticate(a.login.data.accessToken),
    );
    expect(Object.keys(result.user).sort()).toEqual(['email', 'id', 'role']);
  });
  it('rejects stale session at me', async () => {
    const f = fixture();
    const a = await f.account();
    const id = await f.service.authenticate(a.login.data.accessToken);
    a.user.status = 'disabled';
    await expect(f.service.me(id)).rejects.toMatchObject({ status: 401 });
  });
});
