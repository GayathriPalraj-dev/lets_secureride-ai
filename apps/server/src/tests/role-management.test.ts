import { describe, expect, it, vi } from 'vitest';
import {
  createRoleService,
  RoleManagementError,
} from '../authorization/service.js';
import type {
  RoleRepository,
  RoleTarget,
  RoleUser,
} from '../authorization/repository.js';

function setup(users: RoleUser[] = [active()]) {
  const repository: RoleRepository = {
    findTargets: vi.fn(async () => structuredClone(users)),
    changeRole: vi.fn(async (user, role) => ({
      ...user,
      role,
      authVersion: user.authVersion + 1,
    })),
    revokeStaleSessions: vi.fn(async () => 2),
  };
  const events = vi.fn();
  return { repository, events, service: createRoleService(repository, events) };
}
function active(overrides: Partial<RoleUser> = {}): RoleUser {
  return {
    id: 'a'.repeat(24),
    role: 'customer',
    status: 'active',
    authVersion: 3,
    ...overrides,
  };
}
const idTarget: RoleTarget = { kind: 'id', value: 'a'.repeat(24) };
const input = {
  mode: 'apply' as const,
  role: 'admin' as const,
  target: idTarget,
  operationId: 'operation',
};

describe('role management service', () => {
  it('uses an exact ID target', async () => {
    const f = setup();
    await f.service.execute({ ...input, mode: 'check' });
    expect(f.repository.findTargets).toHaveBeenCalledWith(idTarget);
  });
  it('uses a canonical email target', async () => {
    const f = setup();
    const target = { kind: 'email' as const, value: 'user@example.invalid' };
    await f.service.execute({ ...input, target, mode: 'check' });
    expect(f.repository.findTargets).toHaveBeenCalledWith(target);
  });
  it('refuses zero matches', async () => {
    await expect(setup([]).service.execute(input)).rejects.toMatchObject({
      code: 'TARGET_NOT_FOUND',
    });
  });
  it('refuses multiple matches', async () => {
    await expect(
      setup([active(), active({ id: 'b'.repeat(24) })]).service.execute(input),
    ).rejects.toMatchObject({ code: 'TARGET_AMBIGUOUS' });
  });
  it('refuses disabled users', async () => {
    await expect(
      setup([active({ status: 'disabled' })]).service.execute(input),
    ).rejects.toMatchObject({ code: 'TARGET_DISABLED' });
  });
  it('does not mutate in check mode', async () => {
    const f = setup();
    await f.service.execute({ ...input, mode: 'check' });
    expect(f.repository.changeRole).not.toHaveBeenCalled();
    expect(f.repository.revokeStaleSessions).not.toHaveBeenCalled();
  });
  it('promotes a customer', async () => {
    expect((await setup().service.execute(input)).targetRole).toBe('admin');
  });
  it('demotes an admin', async () => {
    const f = setup([active({ role: 'admin' })]);
    const result = await f.service.execute({ ...input, role: 'customer' });
    expect(result.targetRole).toBe('customer');
  });
  it('requests one atomic role and version update', async () => {
    const f = setup();
    await f.service.execute(input);
    expect(f.repository.changeRole).toHaveBeenCalledWith(active(), 'admin');
  });
  it('revokes owned stale sessions', async () => {
    const f = setup();
    await f.service.execute(input);
    expect(f.repository.revokeStaleSessions).toHaveBeenCalledWith(
      'a'.repeat(24),
      4,
    );
  });
  it('reports partial completion after cleanup failure', async () => {
    const f = setup();
    vi.mocked(f.repository.revokeStaleSessions).mockRejectedValueOnce(
      new Error('private'),
    );
    expect((await f.service.execute(input)).status).toBe('partial');
  });
  it('is idempotent at the target role', async () => {
    const f = setup([active({ role: 'admin' })]);
    expect((await f.service.execute(input)).status).toBe('already-set');
    expect(f.repository.changeRole).not.toHaveBeenCalled();
  });
  it('cleans stale sessions on an idempotent rerun', async () => {
    const f = setup([active({ role: 'admin' })]);
    await f.service.execute(input);
    expect(f.repository.revokeStaleSessions).toHaveBeenCalled();
  });
  it('fails an optimistic concurrency miss', async () => {
    const f = setup();
    vi.mocked(f.repository.changeRole).mockResolvedValueOnce(null);
    await expect(f.service.execute(input)).rejects.toBeInstanceOf(
      RoleManagementError,
    );
  });
  it('emits sanitized role-change events', async () => {
    const f = setup();
    await f.service.execute(input);
    const event = f.events.mock.calls[0]![0];
    expect(Object.keys(event).sort()).toEqual([
      'currentRole',
      'event',
      'operationId',
      'outcome',
      'targetRole',
    ]);
    expect(JSON.stringify(event)).not.toContain('a'.repeat(24));
  });
});
