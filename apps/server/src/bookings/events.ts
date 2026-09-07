import type { BookingStatus, Role } from '@lets-secureride-ai/contracts';
export type BookingEventName =
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_CONFLICT'
  | 'BOOKING_MUTATION_CONFLICT'
  | 'BOOKING_OPERATION_FAILED';
export interface BookingEvent {
  event: BookingEventName;
  outcome: 'success' | 'failure';
  requestId?: string;
  operation: string;
  actorRole?: Role;
  fromStatus?: BookingStatus;
  toStatus?: BookingStatus;
}
export type BookingEvents = (event: BookingEvent) => void;
export const createBookingEvents =
  (write: (e: BookingEvent & { timestamp: string }) => void): BookingEvents =>
  (event) => {
    try {
      write({ ...event, timestamp: new Date().toISOString() });
    } catch {
      /* logging cannot change behavior */
    }
  };
