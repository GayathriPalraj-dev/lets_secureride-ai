import { describe, expect, it, vi } from 'vitest';
import {
  executeRoleCommand,
  parseRoleCommand,
  runRoleCommand,
} from '../scripts/manage-role.js';
import { createRoleService } from '../authorization/service.js';
import type { RoleRepository } from '../authorization/repository.js';

const id = 'a'.repeat(24);
function parse(args: string[], env: Record<string, string | undefined> = {}) {
  return parseRoleCommand(args, env);
}
describe('role command', () => {
  it('rejects neither target', () =>
    expect(() => parse(['--check', '--role', 'admin'])).toThrow());
  it('rejects both targets', () =>
    expect(() =>
      parse(['--check', '--role', 'admin'], {
        AUTH_ROLE_TARGET_USER_ID: id,
        AUTH_ROLE_TARGET_EMAIL: 'user@example.invalid',
      }),
    ).toThrow());
  it('rejects blank target', () =>
    expect(() =>
      parse(['--check', '--role', 'admin'], {
        AUTH_ROLE_TARGET_USER_ID: ' ',
      }),
    ).toThrow());
  it('rejects invalid object ID', () =>
    expect(() =>
      parse(['--check', '--role', 'admin'], {
        AUTH_ROLE_TARGET_USER_ID: 'not-an-id',
      }),
    ).toThrow());
  it('reuses canonical email validation', () => {
    expect(
      parse(['--check', '--role', 'admin'], {
        AUTH_ROLE_TARGET_EMAIL: ' USER@EXAMPLE.INVALID ',
      }).target,
    ).toEqual({ kind: 'email', value: 'user@example.invalid' });
  });
  it('requires exactly one mode', () => {
    for (const modes of [[], ['--check', '--apply']])
      expect(() =>
        parse([...modes, '--role', 'admin'], {
          AUTH_ROLE_TARGET_USER_ID: id,
        }),
      ).toThrow();
  });
  it('requires a supported role', () =>
    expect(() =>
      parse(['--check', '--role', 'owner'], {
        AUTH_ROLE_TARGET_USER_ID: id,
      }),
    ).toThrow());
  it('keeps check mode mutation-free', async () => {
    const repository: RoleRepository = {
      findTargets: vi.fn(async () => [
        {
          id,
          role: 'customer' as const,
          status: 'active' as const,
          authVersion: 0,
        },
      ]),
      changeRole: vi.fn(),
      revokeStaleSessions: vi.fn(),
    };
    await runRoleCommand(
      createRoleService(repository, vi.fn()),
      parse(['--check', '--role', 'admin'], {
        AUTH_ROLE_TARGET_USER_ID: id,
      }),
    );
    expect(repository.changeRole).not.toHaveBeenCalled();
  });
  it('never puts target values in failures', () => {
    try {
      parse(['--check', '--role', 'admin'], {
        AUTH_ROLE_TARGET_EMAIL: 'private-marker',
      });
    } catch (error) {
      expect(String(error)).not.toContain('private-marker');
    }
  });
  it('closes its connection after success and failure', async () => {
    const repository: RoleRepository = {
      findTargets: vi.fn(async () => [
        {
          id,
          role: 'customer' as const,
          status: 'active' as const,
          authVersion: 0,
        },
      ]),
      changeRole: vi.fn(),
      revokeStaleSessions: vi.fn(),
    };
    const close = vi.fn(async () => undefined);
    const command = {
      mode: 'check' as const,
      role: 'admin' as const,
      target: { kind: 'id' as const, value: id },
    };
    await executeRoleCommand(command, {
      open: async () => createRoleService(repository, vi.fn()),
      close,
    });
    await expect(
      executeRoleCommand(command, {
        open: async () => {
          throw new Error('synthetic');
        },
        close,
      }),
    ).rejects.toThrow();
    expect(close).toHaveBeenCalledTimes(2);
  });
});
