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
    <main>
      <h1>Sign in</h1>
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
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
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
      <Link to="/register">Create an account</Link> <Link to="/">Home</Link>
    </main>
  );
}
