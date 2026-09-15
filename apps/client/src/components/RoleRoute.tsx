import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';

export function RoleRoute({ role }: { role: Role }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading')
    return (
      <main id="main" className="page-shell recovery-page">
        <section
          className="recovery-card"
          role="status"
          aria-labelledby="role-session-title"
        >
          <span className="recovery-icon" aria-hidden="true">
            ↻
          </span>
          <p className="eyebrow">Secure administration</p>
          <h1 id="role-session-title">Restoring your session…</h1>
          <p>We are securely verifying your administrator access.</p>
          {auth.error && (
            <>
              <p className="recovery-error" role="alert">
                {auth.error}
              </p>
              <button onClick={auth.retry}>Retry</button>
            </>
          )}
        </section>
      </main>
    );
  if (auth.status === 'unauthenticated')
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname.startsWith('/') ? location.pathname : '/',
        }}
      />
    );
  if (!auth.user || auth.user.role !== role)
    return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
