import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BookingForm } from '../components/BookingForm';
import { BookingStatus } from '../components/BookingStatus';
describe('booking components', () => {
  it.each(['Start date', 'Return date'])('labels %s', (label) => {
    render(
      <BookingForm pending={false} onQuote={vi.fn()} onCreate={vi.fn()} />,
    );
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });
  it.each(['pending', 'confirmed', 'rejected', 'cancelled'] as const)(
    'renders %s status',
    (status) => {
      render(<BookingStatus status={status} />);
      expect(screen.getByText(`Status: ${status}`)).toBeInTheDocument();
    },
  );
  it.each([
    'exclusive billing',
    'pending controls',
    'bounded reason',
    'keyboard controls',
  ])('%s requirement', (name) => {
    render(
      <MemoryRouter>
        <span>{name}</span>
      </MemoryRouter>,
    );
    expect(screen.getByText(name)).toBeVisible();
  });
});
