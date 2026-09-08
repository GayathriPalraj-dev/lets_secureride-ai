import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../app/router';
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'u', email: 'admin@example.invalid', role: 'admin' },
    adminCarImages: vi.fn().mockResolvedValue({ items: [], revision: 0 }),
    authorizeCarImage: vi.fn(),
    completeCarImage: vi.fn(),
    primaryCarImage: vi.fn(),
    removeCarImage: vi.fn(),
  }),
}));
describe('car image route integration', () => {
  it('routes administrators to image management', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/cars/car/images']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Manage car images' }),
    ).toBeInTheDocument();
  });
  it('renders upload controls on the admin route', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/cars/car/images']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText('Image')).toBeInTheDocument();
  });
  it('keeps an inventory return path', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/cars/car/images']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('link', { name: 'Back to inventory' }),
    ).toHaveAttribute('href', '/admin/cars');
  });
  it('does not expose provider URLs in the route shell', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/cars/car/images']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Manage car images' });
    expect(document.body.textContent).not.toContain('amazonaws');
  });
});
