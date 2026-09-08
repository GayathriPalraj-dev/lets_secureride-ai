import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarImageManager } from '../components/CarImageManager';
const primary = vi.fn(),
  remove = vi.fn(),
  changed = vi.fn();
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ primaryCarImage: primary, removeCarImage: remove }),
}));
const image = {
  id: 'i',
  altText: 'Front',
  displayOrder: 0,
  isPrimary: false,
  status: 'ready' as const,
  scanState: 'clean' as const,
  failureCategory: null,
  revision: 2,
  uploadExpiresAt: 'x',
  completedAt: 'x',
  verifiedAt: 'x',
  createdAt: 'x',
  updatedAt: 'x',
};
describe('car image manager', () => {
  beforeEach(() => {
    primary.mockReset().mockResolvedValue(image);
    remove.mockReset().mockResolvedValue(image);
    changed.mockReset();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
  });
  it('shows an empty state', () => {
    render(<CarImageManager carId="c" images={[]} onChanged={changed} />);
    expect(screen.getByText('No images uploaded.')).toBeInTheDocument();
  });
  it('renders image alt text', () => {
    render(<CarImageManager carId="c" images={[image]} onChanged={changed} />);
    expect(screen.getByText(/Front/)).toBeInTheDocument();
  });
  it('renders processing state', () => {
    render(
      <CarImageManager
        carId="c"
        images={[{ ...image, status: 'uploaded' }]}
        onChanged={changed}
      />,
    );
    expect(screen.getByText(/uploaded/)).toBeInTheDocument();
  });
  it('offers primary action for ready images', () => {
    render(<CarImageManager carId="c" images={[image]} onChanged={changed} />);
    expect(screen.getByRole('button', { name: 'Set primary' })).toBeEnabled();
  });
  it('disables primary action for pending images', () => {
    render(
      <CarImageManager
        carId="c"
        images={[{ ...image, status: 'pending_upload' }]}
        onChanged={changed}
      />,
    );
    expect(screen.getByRole('button', { name: 'Set primary' })).toBeDisabled();
  });
  it('disables action for current primary', () => {
    render(
      <CarImageManager
        carId="c"
        images={[{ ...image, isPrimary: true }]}
        onChanged={changed}
      />,
    );
    expect(screen.getByRole('button', { name: 'Set primary' })).toBeDisabled();
  });
  it('sets a primary image with revision', async () => {
    render(<CarImageManager carId="c" images={[image]} onChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set primary' }));
    await waitFor(() => expect(primary).toHaveBeenCalledWith('c', 'i', 2));
  });
  it('reloads after primary change', async () => {
    render(<CarImageManager carId="c" images={[image]} onChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set primary' }));
    await waitFor(() => expect(changed).toHaveBeenCalled());
  });
  it('offers removal', () => {
    render(<CarImageManager carId="c" images={[image]} onChanged={changed} />);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled();
  });
  it('confirms removal', async () => {
    render(<CarImageManager carId="c" images={[image]} onChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
  });
  it('removes with optimistic revision', async () => {
    render(<CarImageManager carId="c" images={[image]} onChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('c', 'i', 2));
  });
  it('reloads after removal', async () => {
    render(<CarImageManager carId="c" images={[image]} onChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(changed).toHaveBeenCalled());
  });
  it('honors cancelled confirmation', () => {
    vi.mocked(confirm).mockReturnValue(false);
    render(<CarImageManager carId="c" images={[image]} onChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(remove).not.toHaveBeenCalled();
  });
  it('renders one row per image', () => {
    render(
      <CarImageManager
        carId="c"
        images={[image, { ...image, id: 'j' }]}
        onChanged={changed}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
