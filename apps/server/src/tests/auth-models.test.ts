import { Mongoose } from 'mongoose';
import { afterEach, describe, expect, it } from 'vitest';
import { createAuthModels } from '../auth/repository.js';
import { toAuthUser } from '../auth/response.js';
const instances: Mongoose[] = [];
function models() {
  const instance = new Mongoose();
  instances.push(instance);
  return createAuthModels(instance.createConnection());
}
afterEach(async () => {
  for (const instance of instances.splice(0)) {
    await instance.disconnect();
    for (const c of instance.connections) c.deleteModel(/.*/);
  }
});
describe('disconnected auth models', () => {
  it('normalizes email and defaults public accounts to customer', () => {
    const m = models();
    const u = new m.users({
      email: ' SAMPLE@EXAMPLE.INVALID ',
      passwordHash: 'synthetic-digest',
    });
    expect(u.email).toBe('sample@example.invalid');
    expect(u.role).toBe('customer');
    expect(u.status).toBe('active');
  });
  it.each(['passwordHash', 'authVersion', 'passwordChangedAt'])(
    'hides user field %s',
    (field) => {
      expect(models().users.schema.path(field).options.select).toBe(false);
    },
  );
  it.each(['currentHash', 'usedHashes', 'authVersion', 'revokeReason'])(
    'hides session field %s',
    (field) => {
      expect(models().sessions.schema.path(field).options.select).toBe(false);
    },
  );
  it('declares unique canonical-email index', () => {
    expect(
      models()
        .users.schema.indexes()
        .some(([key, options]) => key.email === 1 && options.unique === true),
    ).toBe(true);
  });
  it.each(['sessions', 'limits'] as const)(
    'declares TTL index for %s',
    (name) => {
      expect(
        models()
          [name].schema.indexes()
          .some(([, options]) => options.expireAfterSeconds === 0),
      ).toBe(true);
    },
  );
  it.each(['users', 'sessions', 'limits'] as const)(
    'disables automatic DDL for %s',
    (name) => {
      const m = models()[name];
      expect(m.schema.options.autoCreate).toBe(false);
      expect(m.schema.options.autoIndex).toBe(false);
    },
  );
  it('maps only the public DTO', () => {
    const input = {
      id: 'a'.repeat(24),
      email: 'sample@example.invalid',
      role: 'customer' as const,
      passwordHash: 'synthetic',
      authVersion: 10,
    };
    expect(Object.keys(toAuthUser(input)).sort()).toEqual([
      'email',
      'id',
      'role',
    ]);
  });
  it('does not share model registries', () => {
    expect(models().users !== models().users).toBe(true);
  });
});
