import type { AuthModels } from './repository.js';
export const expectedIndexes = {
  users: [{ name: 'auth_user_email_unique', key: { email: 1 }, unique: true }],
  sessions: [
    { name: 'auth_session_user_revoked', key: { userId: 1, revokedAt: 1 } },
    {
      name: 'auth_session_expiry',
      key: { absoluteExpiresAt: 1 },
      expireAfterSeconds: 0,
    },
  ],
  limits: [
    { name: 'auth_limit_expiry', key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
} as const;
export async function verifyAuthIndexes(models: AuthModels): Promise<void> {
  try {
    for (const group of ['users', 'sessions', 'limits'] as const) {
      const actual = await models[group].collection.indexes();
      for (const expected of expectedIndexes[group]) {
        const found = actual.find((index) => index.name === expected.name);
        if (
          !found ||
          JSON.stringify(found.key) !== JSON.stringify(expected.key) ||
          Boolean(found.unique) !== 'unique' in expected ||
          found.expireAfterSeconds !==
            ('expireAfterSeconds' in expected
              ? expected.expireAfterSeconds
              : undefined) ||
          found.partialFilterExpression ||
          found.sparse ||
          found.collation
        ) {
          throw new Error('Authentication indexes are unavailable');
        }
      }
    }
  } catch {
    throw new Error('Authentication indexes are unavailable');
  }
}
export async function provisionAuthIndexes(models: AuthModels): Promise<void> {
  // Explicit operator command only. Never drop or synchronize indexes.
  for (const group of ['users', 'sessions', 'limits'] as const) {
    await models[group].createCollection();
    await models[group].createIndexes();
  }
  await verifyAuthIndexes(models);
}
