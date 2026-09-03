import { parseDatabaseEnv } from '../config/env.js';
import { createMongooseContext } from '../config/database.js';
import { createAuthModels } from '../auth/repository.js';
import { provisionAuthIndexes, verifyAuthIndexes } from '../auth/indexes.js';
async function main() {
  if (
    !['--check', '--apply'].includes(process.argv[2] ?? '') ||
    process.argv.length !== 3
  ) {
    process.stdout.write('AUTH_INDEX_COMMAND_REQUIRES_CHECK_OR_APPLY\n');
    process.exitCode = 1;
    return;
  }
  const config = parseDatabaseEnv({
    MONGODB_URI: process.env.MONGODB_URI,
    NODE_ENV: process.env.NODE_ENV,
  });
  const { adapter, connection } = createMongooseContext(config);
  // Consume driver events without exposing their potentially sensitive arguments.
  const unsubscribe = adapter.subscribe(() => undefined);
  try {
    await adapter.open();
    const models = createAuthModels(connection);
    if (process.argv[2] === '--apply') await provisionAuthIndexes(models);
    else await verifyAuthIndexes(models);
    process.stdout.write('AUTH_INDEX_CHECK_PASSED\n');
  } finally {
    try {
      await adapter.close();
    } finally {
      unsubscribe();
    }
  }
}
void main().catch(() => {
  process.stdout.write('AUTH_INDEX_OPERATION_FAILED\n');
  process.exitCode = 1;
});
