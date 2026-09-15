import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { DashboardLayout } from '../components/DashboardLayout';
import { PageIntro } from '../components/PageIntro';

export function AccountPage() {
  const auth = useAuth();
  const [pending, setPending] = useState(false);
  async function logout(all: boolean) {
    setPending(true);
    try {
      await auth.logout(all);
    } catch {
      /* Provider displays the safe failure. */
    } finally {
      setPending(false);
    }
  }
  return (
    <main id="main" className="page-shell">
      <DashboardLayout>
        <PageIntro eyebrow="Customer dashboard" title="Your account">
          Your bookings, payments and account security in one place.
        </PageIntro>
        <section
          className="dashboard-hero"
          aria-labelledby="account-summary-title"
        >
          <div>
            <p className="eyebrow">Your SecureRide account</p>
            <h2 id="account-summary-title">Ready for your next journey?</h2>
            <p>{auth.user?.email}</p>
          </div>
          <Link className="button button-accent" to="/cars">
            Find your next ride
          </Link>
        </section>
        <div className="dashboard-action-grid">
          <Link to="/cars">
            <span aria-hidden="true">⌕</span>
            <strong>Search cars</strong>
            <small>Find the right car for your dates</small>
          </Link>
          <Link to="/bookings">
            <span aria-hidden="true">▣</span>
            <strong>My bookings</strong>
            <small>Review and manage your journeys</small>
          </Link>
          <a href="#session-controls">
            <span aria-hidden="true">⌾</span>
            <strong>Account security</strong>
            <small>Manage your active sessions</small>
          </a>
          {auth.user?.role === 'admin' && (
            <Link to="/admin" aria-label="Administration">
              <span aria-hidden="true">⚙</span>
              <strong>Administration</strong>
              <small>Open operational controls</small>
            </Link>
          )}
        </div>
        <section
          className="account-security-card"
          id="session-controls"
          aria-labelledby="security-title"
        >
          <div>
            <p className="eyebrow">Account security</p>
            <h2 id="security-title">Session controls</h2>
            <p>
              Role: <strong>{auth.user?.role}</strong>
            </p>
          </div>
          <div className="page-actions">
            <button disabled={pending} onClick={() => void logout(false)}>
              Sign out
            </button>
            <button
              className="button-secondary"
              disabled={pending}
              onClick={() => void logout(true)}
            >
              Sign out all devices
            </button>
          </div>
        </section>
      </DashboardLayout>
    </main>
  );
}
