import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading')
    return (
      <div role="status">
        Restoring your session…
        {auth.error && (
          <>
            <p role="alert">{auth.error}</p>
            <button onClick={auth.retry}>Retry</button>
          </>
        )}
      </div>
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
