import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AuthError } from '../services/auth';
export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const summary = useRef<HTMLParagraphElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    if (
      [...password].length < 15 ||
      [...password].length > 128 ||
      new TextEncoder().encode(password).length > 512
    ) {
      setError(
        'Use a password with 15–128 characters and at most 512 UTF-8 bytes.',
      );
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setPending(true);
    setError('');
    try {
      await auth.register({ email: String(form.get('email') ?? ''), password });
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(
        cause instanceof AuthError
          ? cause.message
          : 'Unable to complete registration.',
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
          <p className="eyebrow">Join SecureRide</p>
          <h1>Create your account</h1>
          <p>Save your journeys and book with confidence.</p>
          <div className="auth-benefits" aria-label="Account benefits">
            <span>✓ Secure booking</span>
            <span>✓ Easy trip management</span>
          </div>
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
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              placeholder="you@example.com"
            />
            <label htmlFor="register-password">Password</label>
            <div className="password-field">
              <input
                id="register-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                aria-describedby="password-help"
                placeholder="Create a secure password"
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
            <p id="password-help">
              Use 15–128 characters. Spaces are allowed. Your password is never
              trimmed.
            </p>
            <button disabled={pending}>
              {pending ? 'Creating account…' : 'Register'}
            </button>
          </form>
          <div className="auth-links">
            <span>Already registered?</span>
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </section>
      <aside className="auth-aside" aria-label="Simple car booking">
        <p className="eyebrow">Ready when you are</p>
        <h2>The right car is only a few steps away.</h2>
        <p>
          Clear pricing, dependable inventory and straightforward booking
          management.
        </p>
      </aside>
    </main>
  );
}
