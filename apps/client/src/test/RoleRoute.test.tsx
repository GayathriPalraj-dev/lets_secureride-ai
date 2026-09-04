import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Role } from '@lets-secureride-ai/contracts';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { RoleRoute } from '../components/RoleRoute';

function state(
  status: AuthState['status'],
  role: Role | 'owner' = 'customer',
): AuthState {
  return {
    status,
    user:
      status === 'authenticated'
        ? {
            id: 'a'.repeat(24),
            email: 'user@example.invalid',
            role: role as Role,
          }
        : null,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    retry: vi.fn(),
    verifyAdminAccess: vi.fn(async () => undefined),
  };
}
function view(value: AuthState, path = '/admin') {
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RoleRoute role="admin" />}>
            <Route path="/admin" element={<h1>Verification page</h1>} />
          </Route>
          <Route path="/login" element={<h1>Login page</h1>} />
          <Route path="/forbidden" element={<h1>Forbidden page</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
describe('role route', () => {
  it('hides the admin route during restoration', () => {
    view(state('loading'));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Verification page')).not.toBeInTheDocument();
  });
  it('redirects anonymous users to login', () => {
    view(state('unauthenticated'));
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
  it('retains a safe internal return destination', () => {
    view(state('unauthenticated'), '/admin');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
  it('blocks customers before verification', () => {
    const value = state('authenticated', 'customer');
    view(value);
    expect(screen.getByText('Forbidden page')).toBeInTheDocument();
    expect(value.verifyAdminAccess).not.toHaveBeenCalled();
  });
  it('allows an admin to reach verification', () => {
    view(state('authenticated', 'admin'));
    expect(screen.getByText('Verification page')).toBeInTheDocument();
  });
  it('fails closed for malformed roles', () => {
    view(state('authenticated', 'owner'));
    expect(screen.getByText('Forbidden page')).toBeInTheDocument();
  });
  it('applies policy on direct navigation', () => {
    view(state('authenticated', 'customer'), '/admin');
    expect(screen.getByText('Forbidden page')).toBeInTheDocument();
  });
  it('never flashes unauthorized content', () => {
    view(state('loading'));
    expect(screen.queryByText('Verification page')).not.toBeInTheDocument();
  });
});
