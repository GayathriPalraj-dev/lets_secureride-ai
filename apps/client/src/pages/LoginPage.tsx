import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AuthError } from '../services/auth';
export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const summary = useRef<HTMLParagraphElement>(null);
  const state: unknown = location.state;
  const destination =
    state && typeof state === 'object' && 'from' in state && state.from === '/'
      ? '/'
      : '/account';
  if (auth.status === 'authenticated')
    return <Navigate to={destination} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await auth.login({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      });
      navigate(destination, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof AuthError
          ? cause.message
          : 'Unable to sign in. Please try again.',
      );
      requestAnimationFrame(() => summary.current?.focus());
    } finally {
      setPending(false);
    }
  }
  return (
    <main id="main" className="auth-page">
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in</h1>
          <p>
            Welcome to SecureRide. Manage your journeys, bookings and payments
            securely.
          </p>
          {auth.error && <p role="alert">{auth.error}</p>}
          {error && (
            <p role="alert" tabIndex={-1} ref={summary}>
              {error}
            </p>
          )}
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
          >
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
            />
            <label htmlFor="login-password">Password</label>
            <div className="password-field">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <button disabled={pending || auth.status === 'loading'}>
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          {auth.status === 'loading' && (
            <p role="status">
              Restoring your session…{' '}
              <button onClick={auth.retry}>Retry restoration</button>
            </p>
          )}
          <div className="auth-links">
            <Link to="/register">Create an account</Link>
            <Link to="/">Back home</Link>
          </div>
        </div>
      </section>
      <aside className="auth-aside" aria-label="Secure booking">
        <p className="eyebrow">Drive with confidence</p>
        <h2>Every journey starts with a secure account.</h2>
        <p>
          Your access, bookings and payments are protected from sign-in to
          return.
        </p>
      </aside>
    </main>
  );
}
