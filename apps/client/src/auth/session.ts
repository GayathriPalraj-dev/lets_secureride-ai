import type {
  AuthCredentials,
  AuthUser,
  AuthTokenData,
} from '@lets-secureride-ai/contracts';
import {
  AuthError,
  createAuthRequests,
  type AuthRequests,
} from '../services/auth';
export function createAuthSession(
  requests: AuthRequests = createAuthRequests(),
) {
  let access: string | undefined;
  let expires = 0;
  let generation = 0;
  let refreshPending: Promise<AuthUser> | undefined;
  let restorePending: Promise<AuthUser | null> | undefined;
  const listeners = new Set<() => void>();
  let channel: BroadcastChannel | undefined;
  const clear = () => {
    generation++;
    access = undefined;
    expires = 0;
  };
  function locked<T>(operation: () => Promise<T>): Promise<T> {
    return typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('lsrai-auth', operation)
      : operation();
  }
  function accept(data: AuthTokenData, expected: number) {
    if (expected !== generation) throw new AuthError(401, 'SESSION_CHANGED');
    access = data.accessToken;
    expires = Date.now() + data.expiresIn * 1000 - 5000;
    return data.user;
  }
  function refresh(): Promise<AuthUser> {
    if (!refreshPending) {
      const expected = generation;
      refreshPending = locked(async () => {
        if (expected !== generation)
          throw new AuthError(401, 'SESSION_CHANGED');
        return accept(await requests.refresh(), expected);
      }).finally(() => {
        refreshPending = undefined;
      });
    }
    return refreshPending;
  }
  async function me(): Promise<AuthUser> {
    const expected = generation;
    if (!access || Date.now() >= expires) await refresh();
    try {
      const user = await requests.me(access!);
      if (expected !== generation) throw new AuthError(401, 'SESSION_CHANGED');
      return user;
    } catch (error) {
      if (expected !== generation) throw new AuthError(401, 'SESSION_CHANGED');
      if (!(error instanceof AuthError) || error.status !== 401) throw error;
      await refresh();
      const user = await requests.me(access!);
      if (expected !== generation) throw new AuthError(401, 'SESSION_CHANGED');
      return user;
    }
  }
  return {
    register: (credentials: AuthCredentials) => requests.register(credentials),
    async login(credentials: AuthCredentials) {
      const expected = ++generation;
      return locked(async () => {
        if (expected !== generation)
          throw new AuthError(401, 'SESSION_CHANGED');
        return accept(await requests.login(credentials), expected);
      });
    },
    restore(): Promise<AuthUser | null> {
      restorePending ??= (async () => {
        try {
          await refresh();
          return await me();
        } catch (error) {
          if (error instanceof AuthError && error.status === 401) {
            clear();
            return null;
          }
          throw error;
        }
      })().finally(() => {
        restorePending = undefined;
      });
      return restorePending;
    },
    me,
    async logout(all = false) {
      let token: string | undefined;
      try {
        if (all && (!access || Date.now() >= expires)) await refresh();
        token = access;
      } finally {
        clear();
        channel?.postMessage('logout');
      }
      try {
        await locked(() => requests.logout(token, all));
      } finally {
        for (const listener of listeners) listener();
      }
    },
    subscribeLogout(listener: () => void) {
      listeners.add(listener);
      if (!channel && typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('lsrai-auth');
        channel.onmessage = (event: MessageEvent<unknown>) => {
          if (event.data === 'logout') {
            clear();
            for (const callback of listeners) callback();
          }
        };
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          channel?.close();
          channel = undefined;
        }
      };
    },
    clear,
  };
}
export type AuthSession = ReturnType<typeof createAuthSession>;
