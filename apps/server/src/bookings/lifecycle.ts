import type { BookingStatus, Role } from '@lets-secureride-ai/contracts';
export type BookingAction = 'confirm' | 'reject' | 'cancel';
export function nextBookingStatus(
  current: BookingStatus,
  action: BookingAction,
  role: Role,
  now: Date,
  start: Date,
  end: Date,
): BookingStatus | null {
  if (current === 'rejected' || current === 'cancelled' || now >= end)
    return null;
  if (action === 'confirm')
    return role === 'admin' && current === 'pending' ? 'confirmed' : null;
  if (action === 'reject')
    return role === 'admin' && current === 'pending' ? 'rejected' : null;
  if (role === 'customer' && now >= start) return null;
  return current === 'pending' || current === 'confirmed' ? 'cancelled' : null;
}
