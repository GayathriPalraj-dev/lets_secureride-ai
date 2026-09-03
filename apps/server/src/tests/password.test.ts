import { beforeAll, describe, expect, it } from 'vitest';
import {
  createPasswordService,
  type PasswordService,
} from '../auth/password-service.js';
import { registerSchema } from '../auth/validation.js';
import { credentials } from './helpers/auth.js';
describe('real Argon2 password protection', () => {
  let service: PasswordService;
  beforeAll(async () => {
    service = await createPasswordService();
  });
  it('hashes and verifies without plaintext persistence', async () => {
    const hash = await service.hash(credentials.password);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash.includes(credentials.password)).toBe(false);
    expect(await service.verify(hash, credentials.password)).toBe(true);
  });
  it('uses independent random salts', async () => {
    const a = await service.hash(credentials.password);
    const b = await service.hash(credentials.password);
    expect(a !== b).toBe(true);
  });
  it('rejects incorrect passwords', async () => {
    const hash = await service.hash(credentials.password);
    expect(await service.verify(hash, 'incorrect synthetic value')).toBe(false);
  });
  it('does not trim passwords', async () => {
    const hash = await service.hash(' ' + credentials.password);
    expect(await service.verify(hash, credentials.password)).toBe(false);
  });
  it('supports Unicode', async () => {
    const value = '安全なパスフレーズを長くする例です';
    const hash = await service.hash(value);
    expect(await service.verify(hash, value)).toBe(true);
  });
  it('recognizes its current hashing policy', async () => {
    expect(service.needsRehash(await service.hash(credentials.password))).toBe(
      false,
    );
  });
  it('performs dummy verification without returning credentials', async () => {
    expect(await service.dummyVerify(credentials.password)).toBeUndefined();
  });
  it.each([14, 129])('rejects password length %i', (length) => {
    expect(
      registerSchema.safeParse({ ...credentials, password: 'x'.repeat(length) })
        .success,
    ).toBe(false);
  });
  it.each([15, 128])('accepts password length %i', (length) => {
    expect(
      registerSchema.safeParse({ ...credentials, password: 'x'.repeat(length) })
        .success,
    ).toBe(true);
  });
  it('accepts 128 Unicode code points without UTF-16 truncation', () => {
    expect(
      registerSchema.safeParse({ ...credentials, password: '😀'.repeat(128) })
        .success,
    ).toBe(true);
  });
  it('rejects an extremely common password', () => {
    expect(
      registerSchema.safeParse({ ...credentials, password: 'passwordpassword' })
        .success,
    ).toBe(false);
  });
});
