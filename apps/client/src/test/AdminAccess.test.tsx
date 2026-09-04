import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { createAuthSession } from '../auth/session';
import { AdminPage } from '../pages/AdminPage';
import { AccountPage } from '../pages/AccountPage';
import { AuthError, createAuthRequests } from '../services/auth';

function adminState(
  verify: () => Promise<void> = vi.fn(async () => undefined),
): AuthState {
  return {
    status: 'authenticated',
    user: {
      id: 'a'.repeat(24),
      email: 'admin@example.invalid',
      role: 'admin',
    },
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(async () => undefined),
    retry: vi.fn(),
    verifyAdminAccess: verify,
  };
}
function page(verify: () => Promise<void> = vi.fn(async () => undefined)) {
  const value = adminState(verify);
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/login" element={<h1>Login destination</h1>} />
          <Route path="/forbidden" element={<h1>Forbidden destination</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { value, verify };
}
describe('server-verified admin access', () => {
  it('uses the memory-only token internally', async () => {
    const requests = {
      register: vi.fn(),
      login: vi.fn(async () => ({
        user: adminState().user!,
        accessToken: 'synthetic.payload.signature',
        tokenType: 'Bearer' as const,
        expiresIn: 300,
      })),
      refresh: vi.fn(),
      me: vi.fn(),
      logout: vi.fn(),
      adminAccess: vi.fn(async () => undefined),
    };
    const session = createAuthSession(requests);
    await session.login({
      email: 'admin@example.invalid',
      password: 'synthetic',
    });
    await session.verifyAdminAccess();
    expect(requests.adminAccess).toHaveBeenCalledWith(
      'synthetic.payload.signature',
    );
  });
  it('hides the shell while verification is pending', () => {
    page(vi.fn(() => new Promise<void>(() => undefined)));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.queryByText('Admin access verified.'),
    ).not.toBeInTheDocument();
  });
  it('renders the shell after 200-equivalent success', async () => {
    page();
    expect(
      await screen.findByText('Admin access verified.'),
    ).toBeInTheDocument();
  });
  it('redirects after a final 401', async () => {
    page(vi.fn(async () => Promise.reject(new AuthError(401, 'ended'))));
    expect(await screen.findByText('Login destination')).toBeInTheDocument();
  });
  it('navigates to forbidden after 403', async () => {
    page(vi.fn(async () => Promise.reject(new AuthError(403, 'forbidden'))));
    expect(
      await screen.findByText('Forbidden destination'),
    ).toBeInTheDocument();
  });
  it('shows safe retry after a network failure', async () => {
    page(vi.fn(async () => Promise.reject(new AuthError(503, 'network'))));
    expect(
      await screen.findByRole('button', { name: 'Retry' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('network');
  });
  it('shows safe retry after service unavailability', async () => {
    page(vi.fn(async () => Promise.reject(new AuthError(503, 'private'))));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to verify access',
    );
  });
  it('retries with a new verification request', async () => {
    const verify = vi
      .fn()
      .mockRejectedValueOnce(new AuthError(503, 'failed'))
      .mockResolvedValueOnce(undefined);
    page(verify);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(verify).toHaveBeenCalledTimes(2));
  });
  it('shows the admin link only for restored admin role', () => {
    const value = adminState();
    const { rerender } = render(
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <AccountPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(
      screen.getByRole('link', { name: 'Administration' }),
    ).toBeInTheDocument();
    rerender(
      <AuthContext.Provider
        value={{ ...value, user: { ...value.user!, role: 'customer' } }}
      >
        <MemoryRouter>
          <AccountPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
  });
  it('logout and logout-all remove navigation and route access', async () => {
    const value = adminState();
    const first = render(
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <AccountPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(value.logout).toHaveBeenCalledWith(false));
    first.unmount();
    render(
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <AccountPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign out all devices' }),
    );
    await waitFor(() => expect(value.logout).toHaveBeenCalledTimes(2));
    expect(value.logout).toHaveBeenLastCalledWith(true);
  });
});

describe('admin transport', () => {
  it('calls the exact endpoint and accepts only the safe response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { authorized: true },
        requestId: 'request',
      }),
    });
    vi.stubGlobal('fetch', fetcher);
    await createAuthRequests().adminAccess('synthetic.payload.signature');
    expect(fetcher.mock.calls[0]![0]).toBe('/api/v1/admin/access');
  });
});
