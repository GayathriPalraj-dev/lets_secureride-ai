import type { AdminCar } from '@lets-secureride-ai/contracts';
export function CarInventoryTable({
  cars,
  pendingId,
  onEdit,
  onStatus,
  onDelete,
}: {
  cars: AdminCar[];
  pendingId?: string | undefined;
  onEdit(car: AdminCar): void;
  onStatus(car: AdminCar): void;
  onDelete(car: AdminCar): void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption>Car inventory</caption>
        <thead>
          <tr>
            <th>Car</th>
            <th>Registration</th>
            <th>Status</th>
            <th>Revision</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cars.map((car) => (
            <tr key={car.id}>
              <td>
                {car.make} {car.model}
                <br />
                <small>{car.inventoryCode}</small>
              </td>
              <td>{car.registrationNumber}</td>
              <td>{car.status}</td>
              <td>{car.revision}</td>
              <td>
                <button
                  disabled={pendingId === car.id}
                  onClick={() => onEdit(car)}
                >
                  Edit
                </button>
                <button
                  disabled={pendingId === car.id}
                  onClick={() => onStatus(car)}
                >
                  {car.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  disabled={pendingId === car.id || car.status === 'active'}
                  onClick={() => onDelete(car)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
