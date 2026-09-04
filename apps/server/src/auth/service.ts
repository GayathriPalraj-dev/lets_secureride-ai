import type { AuthConfig } from '../config/auth.js';
import type { Role } from '@lets-secureride-ai/contracts';
import type {
  AuthRepository,
  SessionRecord,
  UserRecord,
} from './repository.js';
import { DuplicateAccount } from './repository.js';
import type { PasswordService } from './password-service.js';
import type { TokenService } from './token-service.js';
import { equalDigest, unauthorized } from './token-service.js';
import type { AuthEvents } from './events.js';
import { toAuthUser } from './response.js';
import { AppError } from '../utils/app-error.js';
export interface AuthIdentity {
  userId: string;
  sessionId: string;
  role: Role;
}
export function createAuthService(
  repo: AuthRepository,
  passwords: PasswordService,
  tokens: TokenService,
  config: AuthConfig,
  events: AuthEvents,
  now: () => Date = () => new Date(),
) {
  function valid(session: SessionRecord, user: UserRecord | null, at: Date) {
    return (
      user?.status === 'active' &&
      user.authVersion === session.authVersion &&
      !session.revokedAt &&
      session.idleExpiresAt > at &&
      session.absoluteExpiresAt > at
    );
  }
  async function result(
    user: UserRecord,
    session: SessionRecord,
    refreshToken: string,
  ) {
    return {
      data: {
        user: toAuthUser(user),
        accessToken: await tokens.sign({
          userId: user.id,
          sessionId: session.id,
          version: session.authVersion,
        }),
        tokenType: 'Bearer' as const,
        expiresIn: config.AUTH_ACCESS_TTL_SECONDS,
      },
      refreshToken,
      expiresAt: session.idleExpiresAt,
    };
  }
  async function reuse(
    session: SessionRecord,
    hash: string,
    requestId: string,
  ) {
    if (session.usedHashes.some((old) => equalDigest(old, hash))) {
      await repo.revokeSession(session.id, 'reuse', now());
      events({
        event: 'AUTH_REFRESH_REUSE',
        requestId,
        outcome: 'failure',
        userId: session.userId,
      });
    }
  }
  return {
    async register(email: string, password: string, requestId: string) {
      const hash = await passwords.hash(password);
      try {
        const user = await repo.createUser(email, hash);
        events({
          event: 'AUTH_REGISTERED',
          requestId,
          outcome: 'success',
          userId: user.id,
        });
        return { user: toAuthUser(user) };
      } catch (error) {
        if (error instanceof DuplicateAccount)
          throw new AppError(
            409,
            'REGISTRATION_FAILED',
            'Unable to complete registration',
          );
        throw error;
      }
    },
    async login(email: string, password: string, requestId: string) {
      const user = await repo.findUserByEmail(email);
      const matches = user
        ? await passwords.verify(user.passwordHash, password)
        : (await passwords.dummyVerify(password), false);
      if (!user || !matches || user.status !== 'active') {
        events({ event: 'AUTH_LOGIN_FAILED', requestId, outcome: 'failure' });
        throw new AppError(
          401,
          'INVALID_CREDENTIALS',
          'Email or password is incorrect',
        );
      }
      if (passwords.needsRehash(user.passwordHash)) {
        await repo.replacePasswordHash(
          user.id,
          user.passwordHash,
          await passwords.hash(password),
        );
      }
      const at = now();
      const refresh = tokens.refresh();
      const absoluteExpiresAt = new Date(
        at.getTime() + config.AUTH_REFRESH_ABSOLUTE_SECONDS * 1000,
      );
      const session: SessionRecord = {
        id: refresh.id,
        userId: user.id,
        authVersion: user.authVersion,
        currentHash: refresh.hash,
        usedHashes: [],
        rotation: 0,
        revokedAt: null,
        lastRefreshedAt: at,
        absoluteExpiresAt,
        idleExpiresAt: new Date(
          Math.min(
            absoluteExpiresAt.getTime(),
            at.getTime() + config.AUTH_REFRESH_IDLE_SECONDS * 1000,
          ),
        ),
      };
      await repo.createSession(session);
      const current = await repo.findUser(user.id);
      if (!valid(session, current, now())) {
        await repo.revokeSession(session.id, 'logout', now());
        throw unauthorized();
      }
      events({
        event: 'AUTH_LOGIN_SUCCEEDED',
        requestId,
        outcome: 'success',
        userId: user.id,
      });
      return result(current!, session, refresh.token);
    },
    async refresh(raw: string | undefined, requestId: string) {
      const parsed = raw ? tokens.parseRefresh(raw) : null;
      if (!parsed) throw unauthorized();
      const session = await repo.findSession(parsed.id, true);
      if (!session) throw unauthorized();
      if (!equalDigest(session.currentHash, parsed.hash)) {
        await reuse(session, parsed.hash, requestId);
        throw unauthorized();
      }
      const user = await repo.findUser(session.userId);
      const at = now();
      if (!valid(session, user, at)) throw unauthorized();
      if (session.rotation >= 10000) {
        await repo.revokeSession(session.id, 'rotation-limit', at);
        throw unauthorized();
      }
      const next = tokens.refresh(session.id);
      const idle = new Date(
        Math.min(
          session.absoluteExpiresAt.getTime(),
          at.getTime() + config.AUTH_REFRESH_IDLE_SECONDS * 1000,
        ),
      );
      const updated = await repo.rotateSession(
        session.id,
        parsed.hash,
        next.hash,
        at,
        idle,
      );
      if (!updated) {
        const latest = await repo.findSession(session.id, true);
        if (latest) await reuse(latest, parsed.hash, requestId);
        throw unauthorized();
      }
      const current = await repo.findUser(session.userId);
      if (!valid(updated, current, now())) throw unauthorized();
      return result(current!, updated, next.token);
    },
    async authenticate(accessToken: string): Promise<AuthIdentity> {
      const identity = await tokens.verify(accessToken);
      const session = await repo.findSession(identity.sessionId);
      if (
        !session ||
        session.userId !== identity.userId ||
        session.authVersion !== identity.version
      )
        throw unauthorized();
      const user = await repo.findUser(identity.userId);
      if (!valid(session, user, now())) throw unauthorized();
      return {
        userId: identity.userId,
        sessionId: identity.sessionId,
        role: user!.role,
      };
    },
    async me(identity: AuthIdentity) {
      const user = await repo.findUser(identity.userId);
      const session = await repo.findSession(identity.sessionId);
      if (!session || !valid(session, user, now())) throw unauthorized();
      return { user: toAuthUser(user!) };
    },
    async logout(raw: string | undefined, requestId: string) {
      const parsed = raw ? tokens.parseRefresh(raw) : null;
      if (parsed) {
        const session = await repo.findSession(parsed.id, true);
        if (
          session &&
          (equalDigest(session.currentHash, parsed.hash) ||
            session.usedHashes.some((hash) => equalDigest(hash, parsed.hash)))
        ) {
          await repo.revokeSession(session.id, 'logout', now());
        }
      }
      events({ event: 'AUTH_LOGOUT', requestId, outcome: 'success' });
      return { loggedOut: true as const };
    },
    async logoutAll(identity: AuthIdentity, requestId: string) {
      await repo.incrementAuthVersion(identity.userId);
      try {
        await repo.revokeAll(identity.userId, now());
      } catch {
        events({
          event: 'AUTH_OPERATION_FAILED',
          requestId,
          outcome: 'failure',
        });
      }
      events({
        event: 'AUTH_LOGOUT_ALL',
        requestId,
        outcome: 'success',
        userId: identity.userId,
      });
      return { loggedOut: true as const };
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
