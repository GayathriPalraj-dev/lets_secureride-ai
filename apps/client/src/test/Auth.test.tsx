import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthProvider';
import { createAuthSession } from '../auth/session';
import { AuthError } from '../services/auth';
import { AppRoutes } from '../app/router';
const user = {
  id: 'a'.repeat(24),
  email: 'customer@example.invalid',
  role: 'customer' as const,
};
const data = {
  user,
  accessToken: 'synthetic.payload.signature',
  tokenType: 'Bearer' as const,
  expiresIn: 300,
};
function fixture(path = '/login', restored = false, state?: unknown) {
  const requests = {
    register: vi.fn(async () => user),
    login: vi.fn(async () => data),
    refresh: vi.fn(async () => {
      if (!restored) throw new AuthError(401, 'missing');
      return data;
    }),
    me: vi.fn(async () => user),
    logout: vi.fn(async () => undefined),
  };
  const session = createAuthSession(requests);
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <AuthProvider session={session}>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </StrictMode>,
  );
  return requests;
}
async function login() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: user.email },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'a synthetic long passphrase' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}
describe('minimal authentication pages', () => {
  it('provides accessible login fields', async () => {
    fixture();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled(),
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });
  it('logs in and renders the account', async () => {
    const r = fixture();
    await login();
    expect(
      await screen.findByRole('heading', { name: 'Your account' }),
    ).toBeInTheDocument();
    expect(r.login).toHaveBeenCalledTimes(1);
  });
  it('displays a safe generic login error', async () => {
    const r = fixture();
    r.login.mockRejectedValue(new AuthError(401, 'failed'));
    await login();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email or password',
    );
  });
  it('restores a session without duplicate StrictMode refresh', async () => {
    const r = fixture('/account', true);
    expect(
      await screen.findByRole('heading', { name: 'Your account' }),
    ).toBeInTheDocument();
    expect(r.refresh).toHaveBeenCalledTimes(1);
  });
  it('redirects unauthenticated account visits', async () => {
    fixture('/account');
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument();
  });
  it('ignores an external redirect destination', async () => {
    fixture('/login', false, { from: 'https://untrusted.example' });
    await login();
    expect(
      await screen.findByRole('heading', { name: 'Your account' }),
    ).toBeInTheDocument();
  });
  it('registers and directs the user to login', async () => {
    const r = fixture('/register');
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'a synthetic long passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument();
    expect(r.register).toHaveBeenCalledTimes(1);
    expect(r.login).not.toHaveBeenCalled();
  });
  it('rejects short registration passwords accessibly', async () => {
    const r = fixture('/register');
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'short' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Register' }).closest('form')!,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('15–128');
    expect(r.register).not.toHaveBeenCalled();
  });
  it('shows a safe duplicate registration failure', async () => {
    const r = fixture('/register');
    r.register.mockRejectedValue(new AuthError(409, 'duplicate'));
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'a synthetic long passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to complete registration',
    );
  });
  it.each([false, true])('logs out with all-devices=%s', async (all) => {
    const r = fixture('/account', true);
    await screen.findByRole('heading', { name: 'Your account' });
    fireEvent.click(
      screen.getByRole('button', {
        name: all ? 'Sign out all devices' : 'Sign out',
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument();
    expect(r.logout).toHaveBeenCalledTimes(1);
  });
  it('reports unconfirmed server logout while clearing local UI', async () => {
    const r = fixture('/account', true);
    r.logout.mockRejectedValue(new AuthError(503, 'unavailable'));
    await screen.findByRole('heading', { name: 'Your account' });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Server-side sign-out could not be confirmed',
    );
  });
});
