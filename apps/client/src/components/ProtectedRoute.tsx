import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading')
    return (
      <main id="main" className="page-shell recovery-page">
        <section
          className="recovery-card"
          role="status"
          aria-labelledby="session-title"
        >
          <span className="recovery-icon" aria-hidden="true">
            ↻
          </span>
          <p className="eyebrow">Secure session</p>
          <h1 id="session-title">Restoring your session…</h1>
          <p>We are securely reconnecting to your SecureRide account.</p>
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
        state={{ from: location.pathname === '/account' ? '/account' : '/' }}
      />
    );
  return <Outlet />;
}
