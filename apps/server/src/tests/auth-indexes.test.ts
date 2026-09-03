import { describe, expect, it, vi } from 'vitest';
import {
  expectedIndexes,
  provisionAuthIndexes,
  verifyAuthIndexes,
} from '../auth/indexes.js';
import type { AuthModels } from '../auth/repository.js';
function fixture() {
  const groups = Object.fromEntries(
    Object.entries(expectedIndexes).map(([name, indexes]) => [
      name,
      {
        collection: {
          indexes: vi
            .fn()
            .mockResolvedValue(indexes.map((index) => ({ ...index }))),
        },
        createCollection: vi.fn().mockResolvedValue(undefined),
        createIndexes: vi.fn().mockResolvedValue(undefined),
      },
    ]),
  );
  return { groups, models: groups as unknown as AuthModels };
}
describe('explicit authentication indexes', () => {
  it('verifies expected indexes without mutation', async () => {
    const f = fixture();
    await verifyAuthIndexes(f.models);
    for (const m of Object.values(f.groups)) {
      expect(m.createCollection).not.toHaveBeenCalled();
      expect(m.createIndexes).not.toHaveBeenCalled();
    }
  });
  it.each(['users', 'sessions', 'limits'])(
    'rejects missing %s indexes',
    async (group) => {
      const f = fixture();
      f.groups[group]!.collection.indexes.mockResolvedValue([]);
      await expect(verifyAuthIndexes(f.models)).rejects.toThrow(
        'Authentication indexes are unavailable',
      );
    },
  );
  it('rejects nonunique email index', async () => {
    const f = fixture();
    f.groups.users!.collection.indexes.mockResolvedValue([
      { name: 'auth_user_email_unique', key: { email: 1 } },
    ]);
    await expect(verifyAuthIndexes(f.models)).rejects.toThrow();
  });
  it('rejects incompatible TTL settings', async () => {
    const f = fixture();
    f.groups.limits!.collection.indexes.mockResolvedValue([
      {
        name: 'auth_limit_expiry',
        key: { expiresAt: 1 },
        expireAfterSeconds: 60,
      },
    ]);
    await expect(verifyAuthIndexes(f.models)).rejects.toThrow();
  });
  it('sanitizes driver failures', async () => {
    const f = fixture();
    f.groups.users!.collection.indexes.mockRejectedValue(
      new Error('synthetic-sensitive'),
    );
    await expect(verifyAuthIndexes(f.models)).rejects.toThrow(
      'Authentication indexes are unavailable',
    );
  });
  it('provisions only when explicitly invoked', async () => {
    const f = fixture();
    await provisionAuthIndexes(f.models);
    for (const m of Object.values(f.groups)) {
      expect(m.createCollection).toHaveBeenCalledTimes(1);
      expect(m.createIndexes).toHaveBeenCalledTimes(1);
    }
  });
});
