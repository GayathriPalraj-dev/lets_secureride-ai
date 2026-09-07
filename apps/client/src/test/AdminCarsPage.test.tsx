import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCarsPage } from '../pages/AdminCarsPage';
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
  features: [],
  registrationNumber: 'KA01AB1234',
  status: 'inactive' as const,
  revision: 1,
  createdAt: 'x',
  updatedAt: 'x',
};
const auth = {
  adminCars: vi.fn(),
  createCar: vi.fn(),
  updateCar: vi.fn(),
  setCarStatus: vi.fn(),
  deleteCar: vi.fn(),
};
vi.mock('../auth/useAuth', () => ({ useAuth: () => auth }));
describe('admin cars page', () => {
  beforeEach(() => {
    Object.values(auth).forEach((fn) => fn.mockReset());
    auth.adminCars.mockResolvedValue({
      items: [car],
      page: 1,
      pageSize: 50,
      totalItems: 1,
      totalPages: 1,
    });
    auth.createCar.mockResolvedValue(car);
    auth.updateCar.mockResolvedValue(car);
    auth.setCarStatus.mockResolvedValue(car);
    auth.deleteCar.mockResolvedValue(car);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
  });
  it('shows loading', () => {
    auth.adminCars.mockReturnValue(new Promise(() => {}));
    render(<AdminCarsPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
  it('loads all inventory', async () => {
    render(<AdminCarsPage />);
    await screen.findByText('KA01AB1234');
    expect(auth.adminCars).toHaveBeenCalledWith({
      status: 'all',
      page: 1,
      pageSize: 50,
    });
  });
  it('renders inventory heading', async () => {
    render(<AdminCarsPage />);
    expect(
      await screen.findByRole('heading', { name: 'Car inventory' }),
    ).toBeInTheDocument();
  });
  it('renders empty state', async () => {
    auth.adminCars.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      totalItems: 0,
      totalPages: 0,
    });
    render(<AdminCarsPage />);
    expect(
      await screen.findByText('No cars in inventory.'),
    ).toBeInTheDocument();
  });
  it('shows safe load error', async () => {
    auth.adminCars.mockRejectedValue(new Error());
    render(<AdminCarsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable');
  });
  it('retries load', async () => {
    auth.adminCars.mockRejectedValueOnce(new Error());
    render(<AdminCarsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('KA01AB1234')).toBeInTheDocument();
  });
  it('opens add form', async () => {
    render(<AdminCarsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Add car' }));
    expect(
      screen.getByRole('heading', { name: 'Add car' }),
    ).toBeInTheDocument();
  });
  it('cancels add form', async () => {
    render(<AdminCarsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Add car' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('heading', { name: 'Add car' }),
    ).not.toBeInTheDocument();
  });
  it('opens edit form', async () => {
    render(<AdminCarsPage />);
    await screen.findByText('KA01AB1234');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(
      screen.getByRole('heading', { name: 'Edit car' }),
    ).toBeInTheDocument();
  });
  it('locks immutable edit fields', async () => {
    render(<AdminCarsPage />);
    await screen.findByText('KA01AB1234');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Inventory code')).toBeDisabled();
  });
  it('activates inactive car', async () => {
    render(<AdminCarsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activate' }));
    await waitFor(() =>
      expect(auth.setCarStatus).toHaveBeenCalledWith(car.id, 1, 'active'),
    );
  });
  it('deactivates active car', async () => {
    auth.adminCars.mockResolvedValue({
      items: [{ ...car, status: 'active' }],
      page: 1,
      pageSize: 50,
      totalItems: 1,
      totalPages: 1,
    });
    render(<AdminCarsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await waitFor(() =>
      expect(auth.setCarStatus).toHaveBeenCalledWith(car.id, 1, 'inactive'),
    );
  });
  it('deletes inactive car after confirmation', async () => {
    render(<AdminCarsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(auth.deleteCar).toHaveBeenCalledWith(car.id, 1));
  });
  it('does not delete when cancelled', async () => {
    vi.mocked(confirm).mockReturnValue(false);
    render(<AdminCarsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(auth.deleteCar).not.toHaveBeenCalled();
  });
  it('disables active deletion', async () => {
    auth.adminCars.mockResolvedValue({
      items: [{ ...car, status: 'active' }],
      page: 1,
      pageSize: 50,
      totalItems: 1,
      totalPages: 1,
    });
    render(<AdminCarsPage />);
    expect(
      await screen.findByRole('button', { name: 'Delete' }),
    ).toBeDisabled();
  });
  it('uses revision for concurrency controls', async () => {
    render(<AdminCarsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activate' }));
    await waitFor(() =>
      expect(auth.setCarStatus).toHaveBeenCalledWith(
        expect.any(String),
        car.revision,
        expect.any(String),
      ),
    );
  });
});
