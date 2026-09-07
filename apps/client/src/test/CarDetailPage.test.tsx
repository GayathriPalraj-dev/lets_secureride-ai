import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarDetailPage } from '../pages/CarDetailPage';
import { CarError } from '../services/cars';
const car = {
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
  description: 'Comfortable',
  features: ['ABS'],
};
const carDetail = vi.fn();
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ carDetail }) }));
function view() {
  return render(
    <MemoryRouter initialEntries={[`/cars/${car.id}`]}>
      <Routes>
        <Route path="/cars/:carId" element={<CarDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
describe('car detail page', () => {
  beforeEach(() => carDetail.mockReset().mockResolvedValue(car));
  it('loads by route id', async () => {
    view();
    await screen.findByText('Tata Nexon');
    expect(carDetail).toHaveBeenCalledWith(car.id);
  });
  it('shows loading', () => {
    view();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
  it('renders description', async () => {
    view();
    expect(await screen.findByText('Comfortable')).toBeInTheDocument();
  });
  it('renders features', async () => {
    view();
    expect(await screen.findByText('ABS')).toBeInTheDocument();
  });
  it('renders empty features', async () => {
    carDetail.mockResolvedValue({ ...car, features: [] });
    view();
    expect(await screen.findByText('No features listed.')).toBeInTheDocument();
  });
  it('handles unavailable car', async () => {
    let reject!: (error: Error) => void;
    carDetail.mockReturnValueOnce(
      new Promise((_resolve, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    view();
    await act(async () => reject(new CarError(404, 'CAR_NOT_FOUND')));
    expect(await screen.findByRole('heading')).toHaveTextContent('unavailable');
  });
  it('shows safe generic error', async () => {
    let reject!: (error: Error) => void;
    carDetail.mockReturnValueOnce(
      new Promise((_resolve, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    view();
    await act(async () => reject(new Error()));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable');
  });
  it('retries generic error', async () => {
    carDetail.mockRejectedValueOnce(new Error()).mockResolvedValue(car);
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Tata Nexon')).toBeInTheDocument();
  });
});
