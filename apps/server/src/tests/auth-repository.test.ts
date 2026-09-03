import { describe, expect, it, vi } from 'vitest';
import {
  createAuthRepository,
  type AuthModels,
  DuplicateAccount,
} from '../auth/repository.js';
function query(value: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
  };
}
function fixture() {
  const users = {
    findOne: vi.fn(() => query(null)),
    findById: vi.fn(() => query(null)),
    create: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const sessions = {
    findById: vi.fn(() => query(null)),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(() => query(null)),
    updateOne: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({}),
  };
  const limits = { findOneAndUpdate: vi.fn(() => query({ count: 1 })) };
  const repo = createAuthRepository({
    users,
    sessions,
    limits,
  } as unknown as AuthModels);
  return { repo, users, sessions, limits };
}
describe('MongoDB repository operation contracts', () => {
  it('excludes password material from ordinary user reads', async () => {
    const f = fixture();
    const q = query(null);
    f.users.findById.mockReturnValue(q);
    await f.repo.findUser('user');
    expect(q.select).toHaveBeenCalledWith('+authVersion');
  });
  it('loads refresh history only for explicit security operations', async () => {
    const f = fixture();
    const q = query(null);
    f.sessions.findById.mockReturnValue(q);
    await f.repo.findSession('session');
    expect(q.select).toHaveBeenLastCalledWith('+authVersion');
    await f.repo.findSession('session', true);
    expect(q.select).toHaveBeenLastCalledWith(
      '+currentHash +usedHashes +authVersion',
    );
  });
  it('queries email as a scalar equality', async () => {
    const f = fixture();
    await f.repo.findUserByEmail('test@example.invalid');
    expect(f.users.findOne).toHaveBeenCalledWith({
      email: 'test@example.invalid',
    });
  });
  it('maps duplicate key failures without raw error data', async () => {
    const f = fixture();
    f.users.create.mockRejectedValue({ code: 11000 });
    await expect(
      f.repo.createUser('test@example.invalid', 'synthetic'),
    ).rejects.toBeInstanceOf(DuplicateAccount);
  });
  it('forces customer role at the persistence boundary', async () => {
    const f = fixture();
    f.users.create.mockResolvedValue({
      _id: 'a'.repeat(24),
      email: 'test@example.invalid',
      passwordHash: 'synthetic',
      role: 'customer',
      status: 'active',
      authVersion: 0,
    });
    await f.repo.createUser('test@example.invalid', 'synthetic');
    expect(f.users.create.mock.calls[0]?.[0].role).toBe('customer');
  });
  it('rotates with a conditional single-document update', async () => {
    const f = fixture();
    const at = new Date();
    await f.repo.rotateSession(
      'session',
      'previous',
      'next',
      at,
      new Date(at.getTime() + 1000),
    );
    const [filter, update, options] = f.sessions.findOneAndUpdate.mock
      .calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(Object.keys(filter).sort()).toEqual([
      '_id',
      'absoluteExpiresAt',
      'currentHash',
      'idleExpiresAt',
      'revokedAt',
      'rotation',
    ]);
    expect(filter.revokedAt).toBeNull();
    expect(Object.keys(update).sort()).toEqual(['$inc', '$push', '$set']);
    expect(options.new).toBe(true);
  });
  it('does not resurrect already revoked sessions', async () => {
    const f = fixture();
    await f.repo.revokeSession('session', 'logout', new Date());
    expect(f.sessions.updateOne.mock.calls[0]?.[0]).toEqual({
      _id: 'session',
      revokedAt: null,
    });
  });
  it('increments the account epoch atomically', async () => {
    const f = fixture();
    await f.repo.incrementAuthVersion('user');
    expect(f.users.updateOne.mock.calls[0]?.[1]).toEqual({
      $inc: { authVersion: 1 },
    });
  });
  it('fails invalidation if account no longer exists', async () => {
    const f = fixture();
    f.users.updateOne.mockResolvedValue({ matchedCount: 0 });
    await expect(f.repo.incrementAuthVersion('user')).rejects.toThrow(
      'Account invalidation failed',
    );
  });
  it('increments shared limit with an upsert', async () => {
    const f = fixture();
    expect(await f.repo.hitLimit('bucket', new Date())).toBe(1);
    expect(f.limits.findOneAndUpdate.mock.calls.length).toBe(1);
  });
  it('retries a duplicate first-writer race without another upsert', async () => {
    const f = fixture();
    f.limits.findOneAndUpdate.mockImplementationOnce(() => ({
      select: vi.fn(),
      lean: vi.fn().mockRejectedValue({ code: 11000 }),
    }));
    expect(await f.repo.hitLimit('bucket', new Date())).toBe(1);
    expect(f.limits.findOneAndUpdate.mock.calls.length).toBe(2);
  });
  it('sanitizes limit-store errors', async () => {
    const f = fixture();
    f.limits.findOneAndUpdate.mockImplementationOnce(() => ({
      select: vi.fn(),
      lean: vi.fn().mockRejectedValue(new Error('synthetic-sensitive')),
    }));
    await expect(f.repo.hitLimit('bucket', new Date())).rejects.toMatchObject({
      status: 503,
    });
  });
});
