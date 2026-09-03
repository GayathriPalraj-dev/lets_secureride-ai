import type { DatabaseManager, LifecycleLog } from './config/database.js';

export interface HttpLifecycle {
  listen(): Promise<void>;
  close(): Promise<void>;
  forceClose(): void;
}
interface Dependencies {
  database: DatabaseManager;
  http: HttpLifecycle;
  log: LifecycleLog;
  setExitCode(code: number): void;
  forceExit(code: number): void;
  subscribeSignals(handler: () => void): () => void;
}

export function createLifecycle(deps: Dependencies) {
  let startup: Promise<void> | undefined;
  let shutdownTask: Promise<void> | undefined;
  let stopping = false;
  let failed = false;
  let unsubscribe: (() => void) | undefined;

  function shutdown(): Promise<void> {
    if (shutdownTask) return shutdownTask;
    stopping = true;
    deps.log('SHUTDOWN_STARTED');
    const timer = setTimeout(() => {
      failed = true;
      deps.log('SHUTDOWN_DEADLINE_EXCEEDED');
      try {
        deps.http.forceClose();
      } catch {
        deps.log('HTTP_FORCE_CLOSE_FAILED');
      }
      deps.database.forceDisconnect();
      unsubscribe?.();
      deps.forceExit(1);
    }, 10_000);
    timer.unref();
    shutdownTask = (async () => {
      try {
        await startup;
        try {
          await deps.http.close();
        } catch {
          failed = true;
          deps.log('HTTP_CLOSE_FAILED');
        }
        try {
          await deps.database.disconnectDatabase();
        } catch {
          failed = true;
          deps.log('DATABASE_CLOSE_FAILED');
        }
      } finally {
        clearTimeout(timer);
        unsubscribe?.();
        unsubscribe = undefined;
        deps.setExitCode(failed ? 1 : 0);
        deps.log('SHUTDOWN_COMPLETED');
      }
    })();
    return shutdownTask;
  }
  async function start() {
    if (stopping) return;
    if (!startup) {
      unsubscribe = deps.subscribeSignals(() => {
        void shutdown();
      });
      startup = (async () => {
        try {
          await deps.database.connectDatabase();
          if (stopping) return;
          await deps.http.listen();
          deps.log('HTTP_LISTENING');
        } catch {
          failed = true;
          deps.setExitCode(1);
          deps.log('STARTUP_FAILED');
        }
      })();
    }
    await startup;
    if (failed) await shutdown();
  }
  return {
    start,
    shutdown,
    isReady: () => !stopping && deps.database.isDatabaseReady(),
  };
}
