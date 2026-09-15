import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AuthError } from '../services/auth';
import { DashboardLayout } from '../components/DashboardLayout';
import { PageIntro } from '../components/PageIntro';

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
      <main id="main" className="page-shell">
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
    <main id="main" className="page-shell">
      <DashboardLayout admin>
        <PageIntro eyebrow="Operations" title="Administration">
          Monitor inventory, bookings and payment reconciliation.
        </PageIntro>
        <p className="sr-only">Admin access verified.</p>
        <div className="feature-grid">
          <article className="feature-card">
            <h2>Car inventory</h2>
            <p>Manage availability, vehicle details and gallery images.</p>
            <Link to="/admin/cars">Manage car inventory</Link>
          </article>
          <article className="feature-card">
            <h2>Bookings</h2>
            <p>Review and manage customer booking requests.</p>
            <Link to="/admin/bookings">Manage bookings</Link>
          </article>
          <article className="feature-card">
            <h2>Payments</h2>
            <p>Review payment and reconciliation status safely.</p>
            <Link to="/admin/payments">Manage payments</Link>
          </article>
        </div>
      </DashboardLayout>
    </main>
  );
}
