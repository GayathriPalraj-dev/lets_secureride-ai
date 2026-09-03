import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { AppError } from '../utils/app-error.js';
export const passwordOptions = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
} as const;
export interface PasswordService {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  dummyVerify(password: string): Promise<void>;
  needsRehash(hash: string): boolean;
}
export async function createPasswordService(): Promise<PasswordService> {
  const dummy = await argon2.hash(randomBytes(32), passwordOptions);
  let active = 0;
  async function bounded<T>(operation: () => Promise<T>): Promise<T> {
    if (active >= 2)
      throw new AppError(
        503,
        'AUTH_UNAVAILABLE',
        'Authentication is temporarily unavailable',
      );
    active++;
    try {
      return await operation();
    } finally {
      active--;
    }
  }
  return {
    hash: (password) => bounded(() => argon2.hash(password, passwordOptions)),
    verify: (hash, password) => bounded(() => argon2.verify(hash, password)),
    dummyVerify: async (password) => {
      await bounded(() => argon2.verify(dummy, password));
    },
    needsRehash: (hash) => argon2.needsRehash(hash, passwordOptions),
  };
}
