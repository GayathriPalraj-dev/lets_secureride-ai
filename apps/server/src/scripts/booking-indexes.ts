import { parseDatabaseEnv } from '../config/env.js';
import { createMongooseContext } from '../config/database.js';
import { createBookingModel } from '../models/booking.js';
import { createBookingOccupancyModel } from '../models/booking-occupancy.js';
import {
  provisionBookingIndexes,
  verifyBookingIndexes,
  type BookingModels,
} from '../bookings/indexes.js';
export interface BookingIndexCommandDependencies {
  open(): Promise<void>;
  close(): Promise<void>;
  unsubscribe(): void;
  models: BookingModels;
  write(s: string): void;
}
export async function runBookingIndexCommand(
  arg: string | undefined,
  d: BookingIndexCommandDependencies,
) {
  try {
    if (!['--check', '--apply'].includes(arg ?? '')) {
      d.write('BOOKING_INDEX_COMMAND_REQUIRES_CHECK_OR_APPLY\n');
      return 1;
    }
    await d.open();
    if (arg === '--apply') await provisionBookingIndexes(d.models);
    else await verifyBookingIndexes(d.models);
    d.write('BOOKING_INDEX_CHECK_PASSED\n');
    return 0;
  } catch {
    d.write('BOOKING_INDEX_OPERATION_FAILED\n');
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
    process.stdout.write('BOOKING_INDEX_COMMAND_REQUIRES_CHECK_OR_APPLY\n');
    process.exitCode = 1;
    return;
  }
  const config = parseDatabaseEnv({
    MONGODB_URI: process.env.MONGODB_URI,
    NODE_ENV: process.env.NODE_ENV,
  });
  const c = createMongooseContext(config);
  const models = {
    bookings: createBookingModel(c.connection),
    occupancies: createBookingOccupancyModel(c.connection),
  };
  const stop = () => {
    void c.adapter.close();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.exitCode = await runBookingIndexCommand(process.argv[2], {
    open: c.adapter.open,
    close: c.adapter.close,
    unsubscribe: () => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    },
    models,
    write: (s) => process.stdout.write(s),
  });
}
if (process.argv[1]?.endsWith('booking-indexes.js'))
  void main().catch(() => {
    process.stdout.write('BOOKING_INDEX_OPERATION_FAILED\n');
    process.exitCode = 1;
  });
