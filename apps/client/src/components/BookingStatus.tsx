import type { BookingStatus as Status } from '@lets-secureride-ai/contracts';
export function BookingStatus({ status }: { status: Status }) {
  return <span className={'booking-status ' + status}>Status: {status}</span>;
}
