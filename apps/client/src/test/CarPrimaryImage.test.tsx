import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarPrimaryImage } from '../components/CarPrimaryImage';
const content = vi.fn(),
  image = {
    id: 'i',
    altText: 'Front',
    displayOrder: 0,
    isPrimary: true,
    contentUrl: '/image',
    width: 640,
    height: 360,
  };
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ carImageContent: content }),
}));
describe('primary car image', () => {
  beforeEach(() => {
    content.mockReset();
    content.mockResolvedValue(new Blob(['x']));
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:safe'),
      revokeObjectURL: vi.fn(),
    });
  });
  it('shows a fallback without an image', () => {
    render(<CarPrimaryImage />);
    expect(screen.getByLabelText('No car image available')).toBeInTheDocument();
  });
  it('loads content through authenticated transport', async () => {
    render(<CarPrimaryImage image={image} />);
    await screen.findByRole('img');
    expect(content).toHaveBeenCalledWith('/image', expect.any(AbortSignal));
  });
  it('uses trusted alternative text', async () => {
    render(<CarPrimaryImage image={image} />);
    expect(await screen.findByAltText('Front')).toBeInTheDocument();
  });
  it('revokes object URLs on cleanup', async () => {
    const view = render(<CarPrimaryImage image={image} />);
    await screen.findByRole('img');
    view.unmount();
    await waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:safe'),
    );
  });
});
