import { parseDatabaseEnv } from '../config/env.js';
import { createMongooseContext } from '../config/database.js';
import { createCarImageModel } from '../models/car-image.js';
import { createCarImageSetModel } from '../models/car-image-set.js';
import { createCarImageScanEventModel } from '../models/car-image-scan-event.js';
import {
  provisionCarImageIndexes,
  verifyCarImageIndexes,
} from '../car-images/indexes.js';
import type { ImageModels } from '../car-images/repository.js';
export interface CarImageIndexCommandDependencies {
  open(): Promise<void>;
  close(): Promise<void>;
  unsubscribe(): void;
  models: ImageModels;
  write(value: string): void;
}
export async function runCarImageIndexCommand(
  arg: string | undefined,
  d: CarImageIndexCommandDependencies,
) {
  try {
    if (!['--check', '--apply'].includes(arg ?? '')) {
      d.write('CAR_IMAGE_INDEX_COMMAND_REQUIRES_CHECK_OR_APPLY\n');
      return 1;
    }
    await d.open();
    if (arg === '--apply') await provisionCarImageIndexes(d.models);
    else await verifyCarImageIndexes(d.models);
    d.write('CAR_IMAGE_INDEX_CHECK_PASSED\n');
    return 0;
  } catch {
    d.write('CAR_IMAGE_INDEX_OPERATION_FAILED\n');
    return 1;
  } finally {
    try {
      await d.close();
    } finally {
      d.unsubscribe();
    }
  }
}
async function main() {
  if (process.argv.length !== 3) {
    process.stdout.write('CAR_IMAGE_INDEX_COMMAND_REQUIRES_CHECK_OR_APPLY\n');
    process.exitCode = 1;
    return;
  }
  const config = parseDatabaseEnv({
    MONGODB_URI: process.env.MONGODB_URI,
    NODE_ENV: process.env.NODE_ENV,
  });
  const context = createMongooseContext(config);
  const models = {
    images: createCarImageModel(context.connection),
    sets: createCarImageSetModel(context.connection),
    events: createCarImageScanEventModel(context.connection),
  };
  const stop = () => {
    void context.adapter.close();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.exitCode = await runCarImageIndexCommand(process.argv[2], {
    open: context.adapter.open,
    close: context.adapter.close,
    unsubscribe: () => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    },
    models,
    write: (value) => process.stdout.write(value),
  });
}
if (process.argv[1]?.endsWith('car-image-indexes.js'))
  void main().catch(() => {
    process.stdout.write('CAR_IMAGE_INDEX_OPERATION_FAILED\n');
    process.exitCode = 1;
  });
