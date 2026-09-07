import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CarCard } from '../components/CarCard';
import { CarFilters } from '../components/CarFilters';
import { Pagination } from '../components/Pagination';
import { CarInventoryTable } from '../components/CarInventoryTable';
import { CarForm } from '../components/CarForm';
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
};
const admin = {
  ...car,
  description: 'Description',
  features: [],
  registrationNumber: 'KA01AB1234',
  status: 'inactive' as const,
  revision: 1,
  createdAt: 'x',
  updatedAt: 'x',
};
describe('car components', () => {
  it('renders a customer card', () => {
    render(
      <MemoryRouter>
        <CarCard car={car} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Tata Nexon');
  });
  it('links cards to detail', () => {
    render(
      <MemoryRouter>
        <CarCard car={car} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', `/cars/${car.id}`);
  });
  it('changes make filter', () => {
    const change = vi.fn();
    render(<CarFilters value={{}} onChange={change} />);
    fireEvent.change(screen.getByLabelText('Make'), {
      target: { value: 'Tata' },
    });
    expect(change).toHaveBeenCalledWith(
      expect.objectContaining({ make: 'Tata', page: 1 }),
    );
  });
  it('clears filters', () => {
    const change = vi.fn();
    render(
      <CarFilters value={{ make: 'Tata', pageSize: 12 }} onChange={change} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(change).toHaveBeenCalledWith({ page: 1, pageSize: 12 });
  });
  it('hides one-page pagination', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
  it('advances pagination', () => {
    const change = vi.fn();
    render(<Pagination page={1} totalPages={2} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(change).toHaveBeenCalledWith(2);
  });
  it('renders inventory registration', () => {
    render(
      <CarInventoryTable
        cars={[admin]}
        onEdit={vi.fn()}
        onStatus={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('KA01AB1234')).toBeInTheDocument();
  });
  it('disables active deletion', () => {
    render(
      <CarInventoryTable
        cars={[{ ...admin, status: 'active' }]}
        onEdit={vi.fn()}
        onStatus={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
  it('renders add form', () => {
    render(<CarForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Add car');
  });
  it('submits trimmed form values', async () => {
    const submit = vi.fn(async () => undefined);
    render(<CarForm onSubmit={submit} />);
    fireEvent.change(screen.getByLabelText('Inventory code'), {
      target: { value: ' CAR-1 ' },
    });
    fireEvent.change(screen.getByLabelText('Registration number'), {
      target: { value: ' KA01AB1234 ' },
    });
    fireEvent.change(screen.getByLabelText('Make'), {
      target: { value: ' Tata ' },
    });
    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: ' Nexon ' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: ' Safe ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save car' }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ inventoryCode: 'CAR-1', make: 'Tata' }),
    );
  });
});
