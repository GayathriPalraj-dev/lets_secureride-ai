import type {
  AdminBooking,
  CustomerBooking,
} from '@lets-secureride-ai/contracts';
export function BookingActions({
  booking,
  admin = false,
  pending,
  onAction,
}: {
  booking: CustomerBooking | AdminBooking;
  admin?: boolean;
  pending: boolean;
  onAction(action: 'confirm' | 'reject' | 'cancel', reason?: string): void;
}) {
  return (
    <div aria-live="polite">
      {admin && booking.status === 'pending' && (
        <>
          <button disabled={pending} onClick={() => onAction('confirm')}>
            Confirm
          </button>
          <button
            disabled={pending}
            onClick={() =>
              onAction('reject', window.prompt('Reason') || undefined)
            }
          >
            Reject
          </button>
        </>
      )}
      {['pending', 'confirmed'].includes(booking.status) && (
        <button
          disabled={pending}
          onClick={() => {
            if (window.confirm('Cancel this booking?')) onAction('cancel');
          }}
        >
          Cancel booking
        </button>
      )}
    </div>
  );
}
