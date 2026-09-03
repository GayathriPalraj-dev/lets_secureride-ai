import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
function renderState(status: AuthState['status'], error: string | null = null) {
  const value: AuthState = {
    status,
    user:
      status === 'authenticated'
        ? {
            id: 'a'.repeat(24),
            email: 'customer@example.invalid',
            role: 'customer',
          }
        : null,
    error,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    retry: vi.fn(),
  };
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<h1>Private account</h1>} />
          </Route>
          <Route path="/login" element={<h1>Login destination</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return value;
}
describe('protected routes', () => {
  it('shows loading without rendering private content', () => {
    renderState('loading');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Private account')).not.toBeInTheDocument();
  });
  it('redirects unauthenticated users', () => {
    renderState('unauthenticated');
    expect(
      screen.getByRole('heading', { name: 'Login destination' }),
    ).toBeInTheDocument();
  });
  it('renders authenticated content', () => {
    renderState('authenticated');
    expect(
      screen.getByRole('heading', { name: 'Private account' }),
    ).toBeInTheDocument();
  });
  it('offers restoration retry on a transient failure', () => {
    renderState('loading', 'Unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('Unavailable');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
