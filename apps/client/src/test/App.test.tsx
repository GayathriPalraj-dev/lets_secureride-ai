import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../App';

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
}

describe('SecureRide homepage', () => {
  it('renders the branded journey heading', () => {
    renderApp();
    expect(
      screen.getByRole('heading', {
        name: 'Book your ride with confidence.',
        level: 1,
      }),
    ).toBeInTheDocument();
  });
  it('provides a skip link and main landmark', () => {
    renderApp();
    expect(screen.getByText('Skip to main content')).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
  it('provides primary and footer navigation', () => {
    renderApp();
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Footer navigation' }),
    ).toBeInTheDocument();
  });
  it('shows the car search interface', () => {
    renderApp();
    expect(
      screen.getByRole('form', { name: 'Find a car' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Search cars' }),
    ).toBeInTheDocument();
  });
  it('shows featured journey categories', () => {
    renderApp();
    expect(
      screen.getByRole('heading', { name: 'A car for every kind of journey' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Family comfort')).toBeInTheDocument();
  });
  it('opens the responsive navigation', () => {
    renderApp();
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
