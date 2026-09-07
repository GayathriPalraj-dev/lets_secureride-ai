import { parseDatabaseEnv } from '../config/env.js';
import { createMongooseContext } from '../config/database.js';
import { createPaymentModel } from '../models/payment.js';
import { createPaymentEventModel } from '../models/payment-event.js';
import {
  provisionPaymentIndexes,
  verifyPaymentIndexes,
} from '../payments/indexes.js';
import type { PaymentModels } from '../payments/repository.js';
export interface PaymentIndexCommandDependencies {
  open(): Promise<void>;
  close(): Promise<void>;
  unsubscribe(): void;
  models: PaymentModels;
  write(value: string): void;
}
export async function runPaymentIndexCommand(
  arg: string | undefined,
  dependencies: PaymentIndexCommandDependencies,
) {
  try {
    if (!['--check', '--apply'].includes(arg ?? '')) {
      dependencies.write('PAYMENT_INDEX_COMMAND_REQUIRES_CHECK_OR_APPLY\n');
      return 1;
    }
    await dependencies.open();
    if (arg === '--apply') await provisionPaymentIndexes(dependencies.models);
    else await verifyPaymentIndexes(dependencies.models);
    dependencies.write('PAYMENT_INDEX_CHECK_PASSED\n');
    return 0;
  } catch {
    dependencies.write('PAYMENT_INDEX_OPERATION_FAILED\n');
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
    process.stdout.write('PAYMENT_INDEX_COMMAND_REQUIRES_CHECK_OR_APPLY\n');
    process.exitCode = 1;
    return;
  }
  const config = parseDatabaseEnv({
    MONGODB_URI: process.env.MONGODB_URI,
    NODE_ENV: process.env.NODE_ENV,
  });
  const context = createMongooseContext(config);
  const models = {
    payments: createPaymentModel(context.connection),
    events: createPaymentEventModel(context.connection),
  };
  const stop = () => {
    void context.adapter.close();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.exitCode = await runPaymentIndexCommand(process.argv[2], {
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
if (process.argv[1]?.endsWith('payment-indexes.js'))
  void main().catch(() => {
    process.stdout.write('PAYMENT_INDEX_OPERATION_FAILED\n');
    process.exitCode = 1;
  });
