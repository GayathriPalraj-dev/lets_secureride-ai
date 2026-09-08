import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCarImagesPage } from '../pages/AdminCarImagesPage';
const list = vi.fn();
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    adminCarImages: list,
    authorizeCarImage: vi.fn(),
    completeCarImage: vi.fn(),
    primaryCarImage: vi.fn(),
    removeCarImage: vi.fn(),
  }),
}));
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return { ...actual, useParams: () => ({ carId: 'car' }) };
});
const page = () =>
  render(
    <MemoryRouter>
      <AdminCarImagesPage />
    </MemoryRouter>,
  );
describe('administrator car images page', () => {
  beforeEach(() =>
    list.mockReset().mockResolvedValue({ items: [], revision: 0 }),
  );
  it('renders the heading', () => {
    page();
    expect(
      screen.getByRole('heading', { name: 'Manage car images' }),
    ).toBeInTheDocument();
  });
  it('shows loading state', async () => {
    let release!: (value: { items: never[]; revision: number }) => void;
    list.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    page();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    release({ items: [], revision: 0 });
    await screen.findByText('No images uploaded.');
  });
  it('loads the route car id', async () => {
    page();
    await waitFor(() => expect(list).toHaveBeenCalledWith('car'));
  });
  it('renders the empty manager state', async () => {
    page();
    expect(await screen.findByText('No images uploaded.')).toBeInTheDocument();
  });
  it('renders upload controls after load', async () => {
    page();
    expect(await screen.findByLabelText('Image')).toBeInTheDocument();
  });
  it('renders a back link', () => {
    page();
    expect(
      screen.getByRole('link', { name: 'Back to inventory' }),
    ).toHaveAttribute('href', '/admin/cars');
  });
  it('passes the set revision to upload controls', async () => {
    list.mockResolvedValue({ items: [], revision: 4 });
    page();
    await screen.findByLabelText('Image');
    expect(screen.getByRole('button', { name: 'Upload image' })).toBeDisabled();
  });
  it('renders returned image state', async () => {
    list.mockResolvedValue({
      items: [
        {
          id: 'i',
          altText: 'Front',
          displayOrder: 0,
          isPrimary: false,
          status: 'ready',
          scanState: 'clean',
          failureCategory: null,
          revision: 0,
          uploadExpiresAt: 'x',
          completedAt: 'x',
          verifiedAt: 'x',
          createdAt: 'x',
          updatedAt: 'x',
        },
      ],
      revision: 0,
    });
    page();
    expect(await screen.findByText(/Front/)).toBeInTheDocument();
  });
  it('retries the list request', async () => {
    list
      .mockRejectedValueOnce(new Error())
      .mockResolvedValue({ items: [], revision: 0 });
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
  it('does not expose storage configuration', async () => {
    page();
    await screen.findByText('No images uploaded.');
    expect(document.body.textContent).not.toContain('bucket');
  });
});
