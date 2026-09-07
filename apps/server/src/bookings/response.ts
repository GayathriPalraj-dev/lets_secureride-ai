import type {
  AdminBooking,
  CustomerBooking,
} from '@lets-secureride-ai/contracts';
import type { BookingRecord } from './repository.js';
const day = (d: Date) => d.toISOString().slice(0, 10);
export function toCustomerBooking(b: BookingRecord): CustomerBooking {
  return {
    id: b.id,
    car: {
      id: b.carId,
      inventoryCode: b.carSnapshot.inventoryCode,
      make: b.carSnapshot.make,
      model: b.carSnapshot.model,
    },
    startDate: day(b.startDate),
    endDateExclusive: day(b.endDateExclusive),
    billableDays: b.billableDays,
    dailyRate: { amountMinor: b.dailyRateMinor, currency: 'INR' },
    total: { amountMinor: b.totalAmountMinor, currency: 'INR' },
    status: b.status,
    revision: b.revision,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}
export function toAdminBooking(b: BookingRecord): AdminBooking {
  return {
    ...toCustomerBooking(b),
    customerReference: b.userId,
    statusChangedAt: b.statusChangedAt.toISOString(),
    statusChangedByRole: b.statusChangedByRole,
    statusReason: b.statusReason,
  };
}
