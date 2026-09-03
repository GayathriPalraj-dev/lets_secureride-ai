import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AuthError } from '../services/auth';
export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
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
    <main>
      <h1>Create an account</h1>
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
        />
        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby="password-help"
        />
        <p id="password-help">
          Use 15–128 characters. Spaces are allowed. Your password is never
          trimmed.
        </p>
        <button disabled={pending}>
          {pending ? 'Creating account…' : 'Register'}
        </button>
      </form>
      <Link to="/login">Sign in</Link>
    </main>
  );
}
