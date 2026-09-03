import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLifecycle } from '../lifecycle.js';
import type { DatabaseManager } from '../config/database.js';

const cleanups: Array<() => Promise<void>> = [];
function fixture() {
  const order: string[] = [];
  const signals = new EventEmitter();
  let connected = false;
  const database: DatabaseManager = {
    connectDatabase: vi.fn(async () => {
      order.push('connect');
      connected = true;
    }),
    disconnectDatabase: vi.fn(async () => {
      order.push('disconnect');
      connected = false;
    }),
    forceDisconnect: vi.fn(),
    getDatabaseStatus: () => (connected ? 'connected' : 'disconnected'),
    isDatabaseReady: () => connected,
  };
  const http = {
    listen: vi.fn(async () => {
      order.push('listen');
    }),
    close: vi.fn(async () => {
      order.push('close');
    }),
    forceClose: vi.fn(),
  };
  const log = vi.fn();
  const setExitCode = vi.fn();
  const forceExit = vi.fn();
  const lifecycle = createLifecycle({
    database,
    http,
    log,
    setExitCode,
    forceExit,
    subscribeSignals(handler) {
      signals.on('signal', handler);
      return () => {
        signals.off('signal', handler);
      };
    },
  });
  cleanups.push(async () => {
    await lifecycle.shutdown();
    expect(signals.listenerCount('signal')).toBe(0);
  });
  return {
    lifecycle,
    database,
    http,
    log,
    setExitCode,
    forceExit,
    order,
    signals,
  };
}
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('startup and shutdown orchestration', () => {
  it('connects before listening and closes HTTP before disconnecting', async () => {
    const f = fixture();
    await f.lifecycle.start();
    expect(f.order).toEqual(['connect', 'listen']);
    await f.lifecycle.shutdown();
    expect(f.order).toEqual(['connect', 'listen', 'close', 'disconnect']);
    expect(f.lifecycle.isReady()).toBe(false);
    expect(f.setExitCode).toHaveBeenLastCalledWith(0);
  });
  it('does not listen when initial connection fails and reports only safe logs', async () => {
    const f = fixture();
    vi.mocked(f.database.connectDatabase).mockRejectedValueOnce(
      new Error('synthetic-private-diagnostic'),
    );
    await f.lifecycle.start();
    expect(f.http.listen).not.toHaveBeenCalled();
    expect(f.database.disconnectDatabase).toHaveBeenCalledTimes(1);
    expect(f.setExitCode).toHaveBeenLastCalledWith(1);
    expect(
      JSON.stringify(f.log.mock.calls).includes('synthetic-private-diagnostic'),
    ).toBe(false);
  });
  it('disconnects after a failed HTTP listener', async () => {
    const f = fixture();
    f.http.listen.mockRejectedValueOnce(new Error('listener failure'));
    await f.lifecycle.start();
    expect(f.database.disconnectDatabase).toHaveBeenCalledTimes(1);
    expect(f.setExitCode).toHaveBeenLastCalledWith(1);
  });
  it('makes repeated starts and signals idempotent and removes signal listeners', async () => {
    const f = fixture();
    await Promise.all([f.lifecycle.start(), f.lifecycle.start()]);
    f.signals.emit('signal');
    f.signals.emit('signal');
    await f.lifecycle.shutdown();
    expect(f.database.connectDatabase).toHaveBeenCalledTimes(1);
    expect(f.http.listen).toHaveBeenCalledTimes(1);
    expect(f.http.close).toHaveBeenCalledTimes(1);
    expect(f.database.disconnectDatabase).toHaveBeenCalledTimes(1);
    expect(f.signals.listenerCount('signal')).toBe(0);
  });
  it('prevents HTTP startup when a connection finishes after a shutdown signal', async () => {
    const f = fixture();
    let finish!: () => void;
    vi.mocked(f.database.connectDatabase).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const starting = f.lifecycle.start();
    f.signals.emit('signal');
    expect(f.lifecycle.isReady()).toBe(false);
    finish();
    await starting;
    await f.lifecycle.shutdown();
    expect(f.http.listen).not.toHaveBeenCalled();
    expect(f.database.disconnectDatabase).toHaveBeenCalledTimes(1);
  });
  it('attempts database cleanup even when HTTP close fails', async () => {
    const f = fixture();
    await f.lifecycle.start();
    f.http.close.mockRejectedValueOnce(new Error('close failed'));
    await f.lifecycle.shutdown();
    expect(f.database.disconnectDatabase).toHaveBeenCalledTimes(1);
    expect(f.setExitCode).toHaveBeenLastCalledWith(1);
  });
  it('reports a failed database close without raw errors', async () => {
    const f = fixture();
    await f.lifecycle.start();
    vi.mocked(f.database.disconnectDatabase).mockRejectedValueOnce(
      new Error('synthetic-private-diagnostic'),
    );
    await f.lifecycle.shutdown();
    expect(f.setExitCode).toHaveBeenLastCalledWith(1);
    expect(
      JSON.stringify(f.log.mock.calls).includes('synthetic-private-diagnostic'),
    ).toBe(false);
  });
  it('bounds shutdown and attempts forced cleanup without exiting the test process', async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.lifecycle.start();
    let finish!: () => void;
    f.http.close.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const stopping = f.lifecycle.shutdown();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(f.http.forceClose).toHaveBeenCalledTimes(1);
    expect(f.database.forceDisconnect).toHaveBeenCalledTimes(1);
    expect(f.forceExit).toHaveBeenCalledWith(1);
    expect(f.signals.listenerCount('signal')).toBe(0);
    finish();
    await stopping;
    expect(vi.getTimerCount()).toBe(0);
  });
});
