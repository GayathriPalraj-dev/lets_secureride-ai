import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabaseManager } from '../config/database.js';
import type {
  DatabaseAdapter,
  DatabaseManager,
  DatabaseStatus,
} from '../config/database.js';

const managers: DatabaseManager[] = [];
const emitters: EventEmitter[] = [];
function fixture() {
  const events = new EventEmitter();
  const open = vi.fn<DatabaseAdapter['open']>().mockResolvedValue(undefined);
  const close = vi.fn<DatabaseAdapter['close']>().mockResolvedValue(undefined);
  const log = vi.fn();
  const manager = createDatabaseManager(
    {
      open,
      close,
      subscribe: (listener) => {
        events.on('state', listener);
        return () => {
          events.off('state', listener);
        };
      },
    },
    log,
  );
  managers.push(manager);
  emitters.push(events);
  return {
    manager,
    open,
    close,
    log,
    emit: (state: DatabaseStatus) => events.emit('state', state),
    events,
  };
}
afterEach(async () => {
  for (const manager of managers.splice(0))
    await manager.disconnectDatabase().catch(() => undefined);
  for (const events of emitters.splice(0))
    expect(events.listenerCount('state')).toBe(0);
  vi.restoreAllMocks();
});

describe('isolated database lifecycle', () => {
  it('does not open a connection when a manager is created', () => {
    const f = fixture();
    expect(f.open).not.toHaveBeenCalled();
    expect(f.manager.getDatabaseStatus()).toBe('disconnected');
    expect(f.events.listenerCount('state')).toBe(0);
  });
  it('connects successfully and reports ready', async () => {
    const f = fixture();
    await f.manager.connectDatabase();
    expect(f.manager.getDatabaseStatus()).toBe('connected');
    expect(f.manager.isDatabaseReady()).toBe(true);
  });
  it('shares concurrent connection attempts and safely repeats a connected call', async () => {
    const f = fixture();
    let resolve!: () => void;
    f.open.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const first = f.manager.connectDatabase();
    const second = f.manager.connectDatabase();
    expect(first === second).toBe(true);
    await Promise.resolve();
    expect(f.open).toHaveBeenCalledTimes(1);
    expect(f.manager.getDatabaseStatus()).toBe('connecting');
    resolve();
    await first;
    await f.manager.connectDatabase();
    expect(f.open).toHaveBeenCalledTimes(1);
  });
  it('sanitizes failed connections, cleans up, and allows a fresh attempt', async () => {
    const f = fixture();
    const sensitive = 'synthetic-private-diagnostic';
    f.open.mockRejectedValueOnce(new Error(sensitive));
    await expect(f.manager.connectDatabase()).rejects.toThrow(
      'Database connection failed',
    );
    expect(f.manager.getDatabaseStatus()).toBe('error');
    expect(JSON.stringify(f.log.mock.calls).includes(sensitive)).toBe(false);
    expect(f.events.listenerCount('state')).toBe(0);
    expect(f.close).toHaveBeenCalledTimes(1);
    await f.manager.connectDatabase();
    expect(f.manager.isDatabaseReady()).toBe(true);
  });
  it('updates readiness on disconnect, error, and reconnect events', async () => {
    const f = fixture();
    await f.manager.connectDatabase();
    for (const state of [
      'disconnected',
      'error',
      'connecting',
      'disconnecting',
    ] as const) {
      f.emit(state);
      expect(f.manager.isDatabaseReady()).toBe(false);
    }
    f.emit('connected');
    expect(f.manager.isDatabaseReady()).toBe(true);
  });
  it('shares disconnection calls and safely repeats them after cleanup', async () => {
    const f = fixture();
    await f.manager.connectDatabase();
    const first = f.manager.disconnectDatabase();
    expect(f.manager.disconnectDatabase() === first).toBe(true);
    expect(f.manager.isDatabaseReady()).toBe(false);
    await first;
    await f.manager.disconnectDatabase();
    expect(f.close).toHaveBeenCalledTimes(1);
    expect(f.events.listenerCount('state')).toBe(0);
  });
  it('closes a connection that finishes during disconnection without becoming ready', async () => {
    const f = fixture();
    let resolve!: () => void;
    f.open.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const opening = f.manager.connectDatabase();
    await Promise.resolve();
    const closing = f.manager.disconnectDatabase();
    await expect(f.manager.connectDatabase()).rejects.toThrow(
      'Database lifecycle is stopping',
    );
    f.emit('connected');
    expect(f.manager.isDatabaseReady()).toBe(false);
    resolve();
    await Promise.all([opening, closing]);
    expect(f.manager.getDatabaseStatus()).toBe('disconnected');
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it('sanitizes disconnection failures and removes event listeners', async () => {
    const f = fixture();
    await f.manager.connectDatabase();
    f.close.mockRejectedValueOnce(new Error('synthetic-private-diagnostic'));
    await expect(f.manager.disconnectDatabase()).rejects.toThrow(
      'Database disconnection failed',
    );
    expect(f.manager.getDatabaseStatus()).toBe('error');
    expect(f.events.listenerCount('state')).toBe(0);
    expect(
      JSON.stringify(f.log.mock.calls).includes('synthetic-private-diagnostic'),
    ).toBe(false);
  });
  it('does not share readiness or listeners between manager instances', async () => {
    const first = fixture();
    const second = fixture();
    await first.manager.connectDatabase();
    expect(second.manager.isDatabaseReady()).toBe(false);
    expect(second.events.listenerCount('state')).toBe(0);
    await first.manager.disconnectDatabase();
    expect(first.events.listenerCount('state')).toBe(0);
  });
  it('closes a disconnected driver and does not create another connection during recovery', async () => {
    const f = fixture();
    await f.manager.connectDatabase();
    f.emit('disconnected');
    await expect(f.manager.connectDatabase()).rejects.toThrow(
      'Database connection is recovering',
    );
    expect(f.open).toHaveBeenCalledTimes(1);
    await f.manager.disconnectDatabase();
    expect(f.close).toHaveBeenCalledTimes(1);
    expect(f.events.listenerCount('state')).toBe(0);
  });
});
