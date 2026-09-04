import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AuthError } from '../services/auth';

type State = 'checking' | 'allowed' | 'forbidden' | 'unauthenticated' | 'error';

export function AdminPage() {
  const auth = useAuth();
  const verifyAdminAccess = auth.verifyAdminAccess;
  const [state, setState] = useState<State>('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void (
      verifyAdminAccess
        ? verifyAdminAccess()
        : Promise.reject(new AuthError(503, 'ADMIN_ACCESS_UNAVAILABLE'))
    )
      .then(() => {
        if (active) setState('allowed');
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof AuthError && error.status === 401)
          setState('unauthenticated');
        else if (error instanceof AuthError && error.status === 403)
          setState('forbidden');
        else setState('error');
      });
    return () => {
      active = false;
    };
  }, [verifyAdminAccess, attempt]);
  if (state === 'unauthenticated') return <Navigate to="/login" replace />;
  if (state === 'forbidden') return <Navigate to="/forbidden" replace />;
  if (state === 'checking') return <p role="status">Verifying admin access…</p>;
  if (state === 'error')
    return (
      <main>
        <h1>Admin access unavailable</h1>
        <p role="alert">Unable to verify access. Please try again.</p>
        <button
          onClick={() => {
            setState('checking');
            setAttempt((value) => value + 1);
          }}
        >
          Retry
        </button>
      </main>
    );
  return (
    <main>
      <h1>Administration</h1>
      <p>Admin access verified.</p>
    </main>
  );
}
