import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import { parseAuthEnv } from '../../config/auth.js';
import { createAuthService } from '../../auth/service.js';
import { createTokenService } from '../../auth/token-service.js';
import {
  DuplicateAccount,
  type AuthRepository,
  type SessionRecord,
  type UserRecord,
} from '../../auth/repository.js';
import type { PasswordService } from '../../auth/password-service.js';
import { createApp } from '../../app.js';
import { parseEnv } from '../../config/env.js';
export const credentials = {
  email: 'customer@example.invalid',
  password: 'A synthetic long passphrase',
};
export function authConfig() {
  return parseAuthEnv({
    JWT_ACCESS_SECRET: Buffer.alloc(32, 11).toString('base64'),
    JWT_ACCESS_KEY_ID: 'test-active',
    JWT_ISSUER: 'test-issuer',
    JWT_AUDIENCE: 'test-audience',
    AUTH_RATE_LIMIT_SECRET: Buffer.alloc(32, 22).toString('base64'),
  });
}
export function fixture(production = false) {
  let clock = new Date();
  let sequence = 1;
  const now = () => new Date(clock);
  const config = authConfig();
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  const limits = new Map<string, number>();
  const hash = (value: string) =>
    createHash('sha256')
      .update('synthetic-only:' + value)
      .digest('hex');
  const passwords: PasswordService = {
    hash: vi.fn(async (value) => hash(value)),
    verify: vi.fn(async (stored, value) => stored === hash(value)),
    dummyVerify: vi.fn(async () => undefined),
    needsRehash: vi.fn(() => false),
  };
  const repo: AuthRepository = {
    findUserByEmail: vi.fn(async (email) =>
      structuredClone(
        [...users.values()].find((u) => u.email === email) ?? null,
      ),
    ),
    findUser: vi.fn(async (id) => structuredClone(users.get(id) ?? null)),
    createUser: vi.fn(async (email, passwordHash) => {
      if ([...users.values()].some((u) => u.email === email))
        throw new DuplicateAccount();
      const id = (sequence++).toString(16).padStart(24, '0');
      const u: UserRecord = {
        id,
        email,
        passwordHash,
        role: 'customer',
        status: 'active',
        authVersion: 0,
      };
      users.set(id, u);
      return structuredClone(u);
    }),
    replacePasswordHash: vi.fn(async (id, old, next) => {
      const u = users.get(id);
      if (u && u.passwordHash === old) u.passwordHash = next;
    }),
    createSession: vi.fn(async (s) => {
      sessions.set(s.id, structuredClone(s));
    }),
    findSession: vi.fn(async (id) => structuredClone(sessions.get(id) ?? null)),
    rotateSession: vi.fn(async (id, old, next, at, idle) => {
      const s = sessions.get(id);
      if (
        !s ||
        s.revokedAt ||
        s.currentHash !== old ||
        s.rotation >= 10000 ||
        s.idleExpiresAt <= at ||
        s.absoluteExpiresAt <= at
      )
        return null;
      s.usedHashes.push(old);
      s.currentHash = next;
      s.rotation++;
      s.lastRefreshedAt = at;
      s.idleExpiresAt = idle;
      return structuredClone(s);
    }),
    revokeSession: vi.fn(async (id, _reason, at) => {
      const s = sessions.get(id);
      if (s && !s.revokedAt) s.revokedAt = at;
    }),
    incrementAuthVersion: vi.fn(async (id) => {
      const u = users.get(id);
      if (!u) throw new Error('Synthetic failure');
      u.authVersion++;
    }),
    revokeAll: vi.fn(async (id, at) => {
      for (const s of sessions.values()) if (s.userId === id) s.revokedAt = at;
    }),
    hitLimit: vi.fn(async (key) => {
      const count = (limits.get(key) ?? 0) + 1;
      limits.set(key, count);
      return count;
    }),
  };
  const events = vi.fn();
  const tokens = createTokenService(config, now);
  const service = createAuthService(
    repo,
    passwords,
    tokens,
    config,
    events,
    now,
  );
  const httpConfig = parseEnv({
    NODE_ENV: production ? 'production' : 'test',
    LOG_LEVEL: 'silent',
  });
  const app = createApp(httpConfig, () => true, {
    repo,
    service,
    tokens,
    config,
    events,
    production,
    origin: httpConfig.CLIENT_ORIGIN,
  });
  async function account() {
    const registered = await service.register(
      credentials.email,
      credentials.password,
      'test-request',
    );
    const login = await service.login(
      credentials.email,
      credentials.password,
      'test-request',
    );
    return {
      user: users.get(registered.user.id)!,
      login,
      session: sessions.get(tokens.parseRefresh(login.refreshToken)!.id)!,
    };
  }
  return {
    repo,
    passwords,
    users,
    sessions,
    limits,
    events,
    tokens,
    service,
    config,
    app,
    now,
    account,
    origin: httpConfig.CLIENT_ORIGIN,
    advance: (ms: number) => {
      clock = new Date(clock.getTime() + ms);
    },
  };
}
