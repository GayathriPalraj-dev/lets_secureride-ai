import { describe, expect, it } from 'vitest';
import { SignJWT, decodeJwt } from 'jose';
import { createTokenService, equalDigest } from '../auth/token-service.js';
import { authConfig, fixture } from './helpers/auth.js';
describe('access token verification', () => {
  it('round-trips only required identifiers', async () => {
    const f = fixture();
    const a = await f.account();
    const result = await f.tokens.verify(a.login.data.accessToken);
    expect(result.userId).toBe(a.user.id);
    expect(result.sessionId).toBe(a.session.id);
    const keys = Object.keys(decodeJwt(a.login.data.accessToken));
    expect(
      keys.includes('email') ||
        keys.includes('role') ||
        keys.includes('password'),
    ).toBe(false);
  });
  it.each(['', 'invalid', 'a.b.c', 'x'.repeat(5000)])(
    'rejects malformed token case %#',
    async (token) => {
      await expect(
        createTokenService(authConfig()).verify(token),
      ).rejects.toMatchObject({ status: 401 });
    },
  );
  it('rejects expired access', async () => {
    const f = fixture();
    const a = await f.account();
    f.advance(331000);
    await expect(
      f.tokens.verify(a.login.data.accessToken),
    ).rejects.toMatchObject({ status: 401 });
  });
  it.each(['iss', 'aud', 'sub', 'sid', 'iat', 'exp', 'jti', 'ver'])(
    'requires claim %s',
    async (missing) => {
      const c = authConfig();
      const at = Math.floor(Date.now() / 1000);
      const claims: Record<string, unknown> = {
        iss: c.JWT_ISSUER,
        aud: c.JWT_AUDIENCE,
        sub: 'a'.repeat(24),
        sid: 'b'.repeat(32),
        iat: at,
        exp: at + 300,
        jti: 'c'.repeat(32),
        ver: 0,
      };
      delete claims[missing];
      const token = await new SignJWT(claims)
        .setProtectedHeader({
          alg: 'HS256',
          typ: 'at+jwt',
          kid: c.JWT_ACCESS_KEY_ID,
        })
        .sign(Buffer.from(c.JWT_ACCESS_SECRET, 'base64'));
      await expect(createTokenService(c).verify(token)).rejects.toMatchObject({
        status: 401,
      });
    },
  );
  it.each([
    'issuer',
    'audience',
    'type',
    'kid',
    'future',
    'long',
    'version',
    'algorithm',
    'signature',
  ])('rejects invalid %s', async (kind) => {
    const c = authConfig();
    const at = Math.floor(Date.now() / 1000);
    const claims = {
      iss: kind === 'issuer' ? 'wrong' : c.JWT_ISSUER,
      aud: kind === 'audience' ? 'wrong' : c.JWT_AUDIENCE,
      sub: 'a'.repeat(24),
      sid: 'b'.repeat(32),
      iat: kind === 'future' ? at + 100 : at,
      exp: kind === 'long' ? at + 1000 : at + 300,
      jti: 'c'.repeat(32),
      ver: kind === 'version' ? -1 : 0,
    };
    const key =
      kind === 'signature'
        ? Buffer.alloc(32, 99)
        : Buffer.from(c.JWT_ACCESS_SECRET, 'base64');
    const token = await new SignJWT(claims)
      .setProtectedHeader({
        alg: kind === 'algorithm' ? 'HS384' : 'HS256',
        typ: kind === 'type' ? 'JWT' : 'at+jwt',
        kid: kind === 'kid' ? 'untrusted' : c.JWT_ACCESS_KEY_ID,
      })
      .sign(key);
    await expect(createTokenService(c).verify(token)).rejects.toMatchObject({
      status: 401,
    });
  });
  it('supports a previous signing key during bounded rotation', async () => {
    const old = authConfig();
    const next = {
      ...old,
      JWT_ACCESS_SECRET: Buffer.alloc(32, 33).toString('base64'),
      JWT_ACCESS_KEY_ID: 'new',
      JWT_ACCESS_PREVIOUS_SECRET: old.JWT_ACCESS_SECRET,
      JWT_ACCESS_PREVIOUS_KEY_ID: old.JWT_ACCESS_KEY_ID,
    };
    const token = await createTokenService(old).sign({
      userId: 'a'.repeat(24),
      sessionId: 'b'.repeat(32),
      version: 0,
    });
    expect((await createTokenService(next).verify(token)).version).toBe(0);
  });
  it('generates unique refresh secrets and validates canonical encoding', () => {
    const t = createTokenService(authConfig());
    const a = t.refresh();
    const b = t.refresh(a.id);
    expect(a.token !== b.token).toBe(true);
    expect(t.parseRefresh(a.token)?.id).toBe(a.id);
    expect(a.hash.length).toBe(64);
  });
  it.each(['', 'invalid', 'a.b', 'x'.repeat(256)])(
    'rejects malformed refresh case %#',
    (value) => {
      expect(createTokenService(authConfig()).parseRefresh(value)).toBeNull();
    },
  );
  it('safely compares only equal-length valid digests', () => {
    expect(equalDigest('x', 'x')).toBe(false);
    expect(equalDigest('a'.repeat(64), 'b'.repeat(64))).toBe(false);
    expect(equalDigest('a'.repeat(64), 'a'.repeat(64))).toBe(true);
  });
});
