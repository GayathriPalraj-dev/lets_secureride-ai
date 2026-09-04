import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { Role } from '@lets-secureride-ai/contracts';
import { createAuthModels } from '../auth/repository.js';
import { canonicalEmailSchema } from '../auth/validation.js';
import { createAuthorizationEvents } from '../authorization/events.js';
import { isRole } from '../authorization/policy.js';
import {
  createRoleRepository,
  type RoleTarget,
} from '../authorization/repository.js';
import {
  createRoleService,
  RoleManagementError,
  type RoleMode,
  type RoleService,
} from '../authorization/service.js';
import { createMongooseContext } from '../config/database.js';
import { parseDatabaseEnv } from '../config/env.js';

export interface RoleCommand {
  mode: RoleMode;
  role: Role;
  target: RoleTarget;
}

export function parseRoleCommand(
  args: readonly string[],
  environment: Record<string, string | undefined>,
): RoleCommand {
  const check = args.includes('--check');
  const apply = args.includes('--apply');
  if (
    check === apply ||
    args.length !== 3 ||
    (args[0] !== '--check' && args[0] !== '--apply')
  )
    throw new RoleManagementError('INVALID_MODE');
  const roleIndexes = args.flatMap((value, index) =>
    value === '--role' ? [index] : [],
  );
  if (roleIndexes.length !== 1) throw new RoleManagementError('INVALID_ROLE');
  const role: unknown = args[roleIndexes[0]! + 1];
  if (!isRole(role)) throw new RoleManagementError('INVALID_ROLE');
  const id = environment.AUTH_ROLE_TARGET_USER_ID;
  const rawEmail = environment.AUTH_ROLE_TARGET_EMAIL;
  const presentId = id !== undefined;
  const presentEmail = rawEmail !== undefined;
  if (presentId === presentEmail)
    throw new RoleManagementError('INVALID_TARGET');
  let target: RoleTarget;
  if (presentId) {
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id.trim()))
      throw new RoleManagementError('INVALID_TARGET');
    target = { kind: 'id', value: id.trim().toLowerCase() };
  } else {
    const parsed = canonicalEmailSchema.safeParse(rawEmail);
    if (!parsed.success) throw new RoleManagementError('INVALID_TARGET');
    target = { kind: 'email', value: parsed.data };
  }
  if (args[1] !== '--role') throw new RoleManagementError('INVALID_ARGUMENT');
  return { mode: check ? 'check' : 'apply', role, target };
}

export async function runRoleCommand(
  service: RoleService,
  command: RoleCommand,
  operationId = randomUUID(),
) {
  return service.execute({ ...command, operationId });
}

export async function executeRoleCommand(
  command: RoleCommand,
  lifecycle: {
    open(): Promise<RoleService>;
    close(): Promise<void>;
  },
) {
  try {
    return await runRoleCommand(await lifecycle.open(), command);
  } finally {
    await lifecycle.close();
  }
}

async function main() {
  let context: ReturnType<typeof createMongooseContext> | undefined;
  try {
    const command = parseRoleCommand(process.argv.slice(2), process.env);
    const database = parseDatabaseEnv({
      MONGODB_URI: process.env.MONGODB_URI,
      NODE_ENV: process.env.NODE_ENV,
    });
    const result = await executeRoleCommand(command, {
      async open() {
        context = createMongooseContext(database);
        await context.adapter.open();
        const repository = createRoleRepository(
          createAuthModels(context.connection),
        );
        const events = createAuthorizationEvents((event) =>
          console.info(JSON.stringify(event)),
        );
        return createRoleService(repository, events);
      },
      async close() {
        await context?.adapter.close();
        context = undefined;
      },
    });
    console.info(
      JSON.stringify({
        result: result.status,
        currentRole: result.currentRole,
        targetRole: result.targetRole,
        revokedSessions: result.revokedSessions,
      }),
    );
    if (result.status === 'partial') process.exitCode = 2;
  } catch (error) {
    const code =
      error instanceof RoleManagementError ? error.code : 'ROLE_COMMAND_FAILED';
    console.error(JSON.stringify({ result: 'failed', code }));
    process.exitCode = 1;
  } finally {
    await context?.adapter.close().catch(() => {
      process.exitCode = 1;
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main();
