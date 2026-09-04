import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';

export function RoleRoute({ role }: { role: Role }) {
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
        state={{
          from: location.pathname.startsWith('/') ? location.pathname : '/',
        }}
      />
    );
  if (!auth.user || auth.user.role !== role)
    return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
