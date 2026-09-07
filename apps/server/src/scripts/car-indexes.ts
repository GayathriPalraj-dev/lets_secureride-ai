import { parseDatabaseEnv } from '../config/env.js';
import { createMongooseContext } from '../config/database.js';
import { createCarModel } from '../models/car.js';
import { provisionCarIndexes, verifyCarIndexes } from '../cars/indexes.js';

export interface CarIndexCommandDependencies {
  open(): Promise<void>;
  close(): Promise<void>;
  unsubscribe(): void;
  models: Parameters<typeof verifyCarIndexes>[0];
  write(message: string): void;
}

export async function runCarIndexCommand(
  argument: string | undefined,
  dependencies: CarIndexCommandDependencies,
): Promise<number> {
  try {
    if (!['--check', '--apply'].includes(argument ?? '')) {
      dependencies.write('CAR_INDEX_COMMAND_REQUIRES_CHECK_OR_APPLY\n');
      return 1;
    }
    await dependencies.open();
    if (argument === '--apply') await provisionCarIndexes(dependencies.models);
    else await verifyCarIndexes(dependencies.models);
    dependencies.write('CAR_INDEX_CHECK_PASSED\n');
    return 0;
  } catch {
    dependencies.write('CAR_INDEX_OPERATION_FAILED\n');
    return 1;
  } finally {
    try {
      await dependencies.close();
    } finally {
      dependencies.unsubscribe();
    }
  }
}

async function main() {
  if (process.argv.length !== 3) {
    process.stdout.write('CAR_INDEX_COMMAND_REQUIRES_CHECK_OR_APPLY\n');
    process.exitCode = 1;
    return;
  }
  const config = parseDatabaseEnv({
    MONGODB_URI: process.env.MONGODB_URI,
    NODE_ENV: process.env.NODE_ENV,
  });
  const { adapter, connection } = createMongooseContext(config);
  const unsubscribe = adapter.subscribe(() => undefined);
  process.exitCode = await runCarIndexCommand(process.argv[2], {
    open: adapter.open,
    close: adapter.close,
    unsubscribe,
    models: { cars: createCarModel(connection) },
    write: (message) => process.stdout.write(message),
  });
}

if (process.argv[1]?.endsWith('car-indexes.js')) {
  void main().catch(() => {
    process.stdout.write('CAR_INDEX_OPERATION_FAILED\n');
    process.exitCode = 1;
  });
}
