import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarsPage } from '../pages/CarsPage';
const summary = {
  id: 'a'.repeat(24),
  inventoryCode: 'CAR-1',
  make: 'Tata',
  model: 'Nexon',
  year: 2025,
  category: 'suv' as const,
  transmission: 'automatic' as const,
  fuelType: 'electric' as const,
  seats: 5,
  dailyRate: { amountMinor: 250000, currency: 'INR' as const },
};
const listCars = vi.fn();
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ listCars }) }));
const page = (items = [summary], totalPages = 1) => ({
  items,
  page: 1,
  pageSize: 12,
  totalItems: items.length,
  totalPages,
});
describe('cars page', () => {
  beforeEach(() => listCars.mockReset().mockResolvedValue(page()));
  it('shows loading', () => {
    render(
      <MemoryRouter>
        <CarsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
  it('renders cars', async () => {
    render(
      <MemoryRouter>
        <CarsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Tata Nexon')).toBeInTheDocument();
  });
  it('shows empty state', async () => {
    listCars.mockResolvedValue(page([]));
    render(
      <MemoryRouter>
        <CarsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/No cars match/)).toBeInTheDocument();
  });
  it('shows safe error', async () => {
    let reject!: (error: Error) => void;
    listCars.mockReturnValueOnce(
      new Promise((_resolve, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    render(
      <MemoryRouter>
        <CarsPage />
      </MemoryRouter>,
    );
    await act(async () => reject(new Error()));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable');
  });
  it('retries errors', async () => {
    listCars.mockRejectedValueOnce(new Error()).mockResolvedValue(page());
    render(
      <MemoryRouter>
        <CarsPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Tata Nexon')).toBeInTheDocument();
  });
  it('filters by make', async () => {
    render(
      <MemoryRouter>
        <CarsPage />
      </MemoryRouter>,
    );
    await screen.findByText('Tata Nexon');
    fireEvent.change(screen.getByLabelText('Make'), {
      target: { value: 'Tata' },
    });
    await waitFor(() =>
      expect(listCars).toHaveBeenLastCalledWith(
        expect.objectContaining({ make: 'Tata' }),
      ),
    );
  });
  it('filters by category', async () => {
    render(
      <MemoryRouter>
        <CarsPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'suv' },
    });
    await waitFor(() =>
      expect(listCars).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'suv' }),
      ),
    );
  });
  it('sorts cars', async () => {
    render(
      <MemoryRouter>
        <CarsPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Sort'), {
      target: { value: 'price_asc' },
    });
    await waitFor(() =>
      expect(listCars).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'price_asc' }),
      ),
    );
  });
  it('moves to next page', async () => {
    listCars.mockResolvedValue(page([summary], 2));
    render(
      <MemoryRouter>
        <CarsPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(listCars).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
  });
  it('uses authenticated request abstraction', async () => {
    render(
      <MemoryRouter>
        <CarsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(listCars).toHaveBeenCalledWith({
        page: 1,
        pageSize: 12,
        sort: 'make_asc',
      }),
    );
  });
});
