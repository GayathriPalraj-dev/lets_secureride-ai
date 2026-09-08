import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CarImageGallery } from '../components/CarImageGallery';
vi.mock('../components/CarPrimaryImage', () => ({
  CarPrimaryImage: ({ image }: { image: { id: string } }) => (
    <span data-testid="image">{image.id}</span>
  ),
}));
const a = {
    id: 'a',
    altText: 'Front',
    displayOrder: 1,
    isPrimary: false,
    contentUrl: '/a',
    width: 640,
    height: 360,
  },
  b = { ...a, id: 'b', altText: 'Primary', displayOrder: 7, isPrimary: true };
describe('car image gallery', () => {
  it('shows an empty state', () => {
    render(<CarImageGallery images={[]} />);
    expect(screen.getByText('No images available.')).toBeInTheDocument();
  });
  it('labels the gallery', () => {
    render(<CarImageGallery images={[a]} />);
    expect(
      screen.getByRole('region', { name: 'Car images' }),
    ).toBeInTheDocument();
  });
  it('renders each image once', () => {
    render(<CarImageGallery images={[a, b]} />);
    expect(screen.getAllByTestId('image')).toHaveLength(2);
  });
  it('renders captions', () => {
    render(<CarImageGallery images={[a]} />);
    expect(screen.getByText('Front')).toBeInTheDocument();
  });
  it('puts primary first', () => {
    render(<CarImageGallery images={[a, b]} />);
    expect(screen.getAllByTestId('image')[0]).toHaveTextContent('b');
  });
  it('then orders by display order', () => {
    render(
      <CarImageGallery images={[{ ...a, id: 'c', displayOrder: 2 }, a]} />,
    );
    expect(screen.getAllByTestId('image')[0]).toHaveTextContent('a');
  });
  it('does not mutate input order', () => {
    const input = [a, b];
    render(<CarImageGallery images={input} />);
    expect(input[0]).toBe(a);
  });
  it('uses figure semantics', () => {
    const { container } = render(<CarImageGallery images={[a]} />);
    expect(container.querySelectorAll('figure')).toHaveLength(1);
  });
  it('uses figcaption semantics', () => {
    const { container } = render(<CarImageGallery images={[a]} />);
    expect(container.querySelector('figcaption')).toHaveTextContent('Front');
  });
  it('supports a single primary image', () => {
    render(<CarImageGallery images={[b]} />);
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });
});
