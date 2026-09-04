import { useEffect, useState, type ReactNode } from 'react';
import { AuthContext, type AuthState } from './AuthContext';
import { createAuthSession, type AuthSession } from './session';
import { AuthError } from '../services/auth';
import type { AuthUser } from '@lets-secureride-ai/contracts';
export function AuthProvider({
  children,
  session: supplied,
}: {
  children: ReactNode;
  session?: AuthSession;
}) {
  const [session] = useState(() => supplied ?? createAuthSession());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const unsubscribe = session.subscribeLogout(() => {
      if (active) {
        setUser(null);
        setStatus('unauthenticated');
      }
    });
    void session
      .restore()
      .then((value) => {
        if (active) {
          setUser(value);
          setStatus(value ? 'authenticated' : 'unauthenticated');
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError('Unable to restore your session. Please retry.');
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [session, attempt]);
  const value: AuthState = {
    user,
    status,
    error,
    async register(credentials) {
      await session.register(credentials);
    },
    async login(credentials) {
      const value = await session.login(credentials);
      setUser(value);
      setStatus('authenticated');
      setError(null);
    },
    async logout(all = false) {
      setUser(null);
      setStatus('unauthenticated');
      setError(null);
      try {
        await session.logout(all);
      } catch {
        setError(
          'Signed out locally. Server-side sign-out could not be confirmed; retry when connected.',
        );
        throw new AuthError(503, 'LOGOUT_UNCONFIRMED');
      }
    },
    async verifyAdminAccess() {
      try {
        await session.verifyAdminAccess();
      } catch (failure) {
        if (failure instanceof AuthError && failure.status === 401) {
          session.clear();
          setUser(null);
          setStatus('unauthenticated');
        }
        throw failure;
      }
    },
    retry() {
      setError(null);
      setStatus('loading');
      setAttempt((value) => value + 1);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
