import { Mongoose } from 'mongoose';
import type { DatabaseConfig } from './env.js';

export type DatabaseStatus =
  'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';
export type LifecycleLog = (event: string, state?: DatabaseStatus) => void;
export interface DatabaseAdapter {
  open(): Promise<void>;
  close(force?: boolean): Promise<void>;
  subscribe(listener: (state: DatabaseStatus) => void): () => void;
}
export interface DatabaseManager {
  connectDatabase(): Promise<void>;
  disconnectDatabase(): Promise<void>;
  forceDisconnect(): void;
  getDatabaseStatus(): DatabaseStatus;
  isDatabaseReady(): boolean;
}

export function createMongooseAdapter(config: DatabaseConfig): DatabaseAdapter {
  return createMongooseContext(config).adapter;
}

export function createMongooseContext(config: DatabaseConfig) {
  const instance = new Mongoose();
  const connection = instance.createConnection();
  const adapter: DatabaseAdapter = {
    async open() {
      await connection.openUri(config.MONGODB_URI, {
        serverSelectionTimeoutMS: 30_000,
        connectTimeoutMS: 10_000,
        maxPoolSize: 10,
        minPoolSize: 0,
        bufferCommands: false,
        autoCreate: false,
        autoIndex: false,
      });
    },
    async close(force = false) {
      if (force) await connection.destroy(true);
      else await connection.close();
    },
    subscribe(listener) {
      const states: DatabaseStatus[] = [
        'connecting',
        'connected',
        'disconnecting',
        'disconnected',
        'error',
      ];
      const handlers = states.map((state) => {
        // Deliberately ignore all event arguments, including driver exceptions.
        const handler = () => listener(state);
        connection.on(state, handler);
        return { state, handler };
      });
      return () => {
        for (const { state, handler } of handlers)
          connection.off(state, handler);
      };
    },
  };
  return { adapter, connection };
}

export function createDatabaseManager(
  adapter: DatabaseAdapter,
  log: LifecycleLog,
): DatabaseManager {
  let state: DatabaseStatus = 'disconnected';
  let opening: Promise<void> | undefined;
  let closing: Promise<void> | undefined;
  let stopping = false;
  let active = false;
  let unsubscribe: (() => void) | undefined;
  function transition(next: DatabaseStatus) {
    if (state !== next) {
      state = next;
      log('DATABASE_STATE_CHANGED', next);
    }
  }
  function detach() {
    unsubscribe?.();
    unsubscribe = undefined;
  }
  function connectDatabase(): Promise<void> {
    if (closing || stopping)
      return Promise.reject(new Error('Database lifecycle is stopping'));
    if (opening) return opening;
    if (state === 'connected') return Promise.resolve();
    if (active)
      return Promise.reject(new Error('Database connection is recovering'));
    unsubscribe ??= adapter.subscribe((next) => {
      if (!stopping) transition(next);
    });
    transition('connecting');
    active = true;
    opening = Promise.resolve()
      .then(() => adapter.open())
      .then(() => {
        if (!stopping) transition('connected');
      })
      .catch(async () => {
        if (!stopping) {
          log('DATABASE_CONNECT_FAILED');
          try {
            await adapter.close();
            active = false;
          } catch {
            log('DATABASE_CLEANUP_FAILED');
          }
          transition('error');
          detach();
        }
        throw new Error('Database connection failed');
      })
      .finally(() => {
        opening = undefined;
      });
    return opening;
  }
  function disconnectDatabase(): Promise<void> {
    if (closing) return closing;
    if (state === 'disconnected' && !opening && !active) {
      detach();
      return Promise.resolve();
    }
    stopping = true;
    transition('disconnecting');
    const pending = opening;
    closing = (async () => {
      try {
        await pending?.catch(() => undefined);
        await adapter.close();
        active = false;
        transition('disconnected');
      } catch {
        transition('error');
        log('DATABASE_DISCONNECT_FAILED');
        throw new Error('Database disconnection failed');
      } finally {
        detach();
        stopping = false;
        closing = undefined;
      }
    })();
    return closing;
  }
  return {
    connectDatabase,
    disconnectDatabase,
    getDatabaseStatus: () => state,
    isDatabaseReady: () => state === 'connected' && !stopping,
    forceDisconnect() {
      stopping = true;
      transition('disconnecting');
      void adapter
        .close(true)
        .catch(() => log('DATABASE_FORCE_CLOSE_FAILED'))
        .finally(detach);
    },
  };
}
