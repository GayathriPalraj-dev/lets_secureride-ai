import type { Connection } from 'mongoose';
import { AppError } from '../utils/app-error.js';
import { createUserModel } from '../models/user.js';
import { createSessionModel } from '../models/auth-session.js';
import { createRateLimitModel } from '../models/auth-rate-limit.js';
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: 'customer' | 'admin';
  status: 'active' | 'disabled';
  authVersion: number;
}
export interface SessionRecord {
  id: string;
  userId: string;
  authVersion: number;
  currentHash: string;
  usedHashes: string[];
  rotation: number;
  lastRefreshedAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}
export type RevokeReason = 'logout' | 'logout-all' | 'reuse' | 'rotation-limit';
export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUser(id: string): Promise<UserRecord | null>;
  createUser(email: string, passwordHash: string): Promise<UserRecord>;
  replacePasswordHash(
    id: string,
    previous: string,
    next: string,
  ): Promise<void>;
  createSession(session: SessionRecord): Promise<void>;
  findSession(id: string, withSecrets?: boolean): Promise<SessionRecord | null>;
  rotateSession(
    id: string,
    previous: string,
    next: string,
    now: Date,
    idleExpiresAt: Date,
  ): Promise<SessionRecord | null>;
  revokeSession(id: string, reason: RevokeReason, now: Date): Promise<void>;
  incrementAuthVersion(id: string): Promise<void>;
  revokeAll(id: string, now: Date): Promise<void>;
  hitLimit(key: string, expiresAt: Date): Promise<number>;
}
export class DuplicateAccount extends Error {
  constructor() {
    super('Registration unavailable');
  }
}
export function isDuplicate(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
export function createAuthModels(connection: Connection) {
  return {
    users: createUserModel(connection),
    sessions: createSessionModel(connection),
    limits: createRateLimitModel(connection),
  };
}
export type AuthModels = ReturnType<typeof createAuthModels>;
const userSelection = '+passwordHash +authVersion';
const sessionSelection = '+currentHash +usedHashes +authVersion';
export function createAuthRepository(models: AuthModels): AuthRepository {
  function user(row: {
    _id: { toString(): string };
    email: string;
    passwordHash?: string;
    role: string;
    status: string;
    authVersion: number;
  }): UserRecord {
    if (
      !['customer', 'admin'].includes(row.role) ||
      !['active', 'disabled'].includes(row.status)
    )
      throw new Error('Invalid account state');
    return {
      id: row._id.toString(),
      email: row.email,
      passwordHash: row.passwordHash ?? '',
      role: row.role as UserRecord['role'],
      status: row.status as UserRecord['status'],
      authVersion: row.authVersion,
    };
  }
  function session(row: {
    _id: string;
    userId: { toString(): string };
    authVersion: number;
    currentHash?: string;
    usedHashes?: string[];
    rotation: number;
    lastRefreshedAt: Date;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
    revokedAt?: Date | null;
  }): SessionRecord {
    return {
      id: row._id,
      userId: row.userId.toString(),
      authVersion: row.authVersion,
      currentHash: row.currentHash ?? '',
      usedHashes: [...(row.usedHashes ?? [])],
      rotation: row.rotation,
      lastRefreshedAt: row.lastRefreshedAt,
      idleExpiresAt: row.idleExpiresAt,
      absoluteExpiresAt: row.absoluteExpiresAt,
      revokedAt: row.revokedAt ?? null,
    };
  }
  return {
    async findUserByEmail(email) {
      const row = await models.users
        .findOne({ email })
        .select(userSelection)
        .lean();
      return row ? user(row) : null;
    },
    async findUser(id) {
      const row = await models.users.findById(id).select('+authVersion').lean();
      return row ? user(row) : null;
    },
    async createUser(email, passwordHash) {
      try {
        return user(
          await models.users.create({
            email,
            passwordHash,
            role: 'customer',
            status: 'active',
            authVersion: 0,
          }),
        );
      } catch (error) {
        if (isDuplicate(error)) throw new DuplicateAccount();
        throw new AppError(
          503,
          'AUTH_UNAVAILABLE',
          'Authentication is temporarily unavailable',
        );
      }
    },
    async replacePasswordHash(id, previous, next) {
      await models.users.updateOne(
        { _id: id, passwordHash: previous },
        { $set: { passwordHash: next } },
      );
    },
    async createSession(value) {
      const { id, ...fields } = value;
      await models.sessions.create({ _id: id, ...fields });
    },
    async findSession(id, withSecrets = false) {
      const row = await models.sessions
        .findById(id)
        .select(withSecrets ? sessionSelection : '+authVersion')
        .lean();
      return row ? session(row) : null;
    },
    async rotateSession(id, previous, next, now, idleExpiresAt) {
      const row = await models.sessions
        .findOneAndUpdate(
          {
            _id: id,
            currentHash: previous,
            revokedAt: null,
            rotation: { $lt: 10000 },
            idleExpiresAt: { $gt: now },
            absoluteExpiresAt: { $gt: now },
          },
          {
            $set: { currentHash: next, lastRefreshedAt: now, idleExpiresAt },
            $push: { usedHashes: previous },
            $inc: { rotation: 1 },
          },
          { new: true },
        )
        .select(sessionSelection)
        .lean();
      return row ? session(row) : null;
    },
    async revokeSession(id, reason, now) {
      await models.sessions.updateOne(
        { _id: id, revokedAt: null },
        { $set: { revokedAt: now, revokeReason: reason } },
      );
    },
    async incrementAuthVersion(id) {
      const result = await models.users.updateOne(
        { _id: id, status: 'active' },
        { $inc: { authVersion: 1 } },
      );
      if (result.matchedCount !== 1)
        throw new Error('Account invalidation failed');
    },
    async revokeAll(id, now) {
      await models.sessions.updateMany(
        { userId: id, revokedAt: null },
        { $set: { revokedAt: now, revokeReason: 'logout-all' } },
      );
    },
    async hitLimit(key, expiresAt) {
      const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt } };
      try {
        const row = await models.limits
          .findOneAndUpdate({ _id: key }, update, { upsert: true, new: true })
          .lean();
        if (!row) throw new Error('Rate limit unavailable');
        return row.count;
      } catch (error) {
        if (!isDuplicate(error))
          throw new AppError(
            503,
            'AUTH_UNAVAILABLE',
            'Authentication is temporarily unavailable',
          );
        const row = await models.limits
          .findOneAndUpdate({ _id: key }, { $inc: { count: 1 } }, { new: true })
          .lean();
        if (!row)
          throw new AppError(
            503,
            'AUTH_UNAVAILABLE',
            'Authentication is temporarily unavailable',
          );
        return row.count;
      }
    },
  };
}
