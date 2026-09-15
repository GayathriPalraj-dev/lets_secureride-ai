import type { AdminCar } from '@lets-secureride-ai/contracts';
import { Link } from 'react-router-dom';
import { localCarImage } from '../utils/carVisuals';
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cars.map((car) => (
            <tr key={car.id}>
              <td>
                <div className="inventory-car">
                  <img src={localCarImage(car)} alt="" />
                  <div>
                    <strong>{car.make} {car.model}</strong>
                    <small>{car.inventoryCode}</small>
                  </div>
                </div>
              </td>
              <td>{car.registrationNumber}</td>
              <td><span className={`inventory-status is-${car.status}`}>{car.status}</span></td>
              <td>
                <div className="inventory-actions">
                  <Link className="button button-small inventory-images-link" to={`/admin/cars/${car.id}/images`}>
                    Images
                  </Link>
                  <button className="button-small" disabled={pendingId === car.id} onClick={() => onEdit(car)}>Edit</button>
                  <button className="button-small button-secondary" disabled={pendingId === car.id} onClick={() => onStatus(car)}>
                    {car.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="button-small inventory-delete" disabled={pendingId === car.id || car.status === 'active'} onClick={() => onDelete(car)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
