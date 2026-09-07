export type CarEventName =
  | 'CAR_CREATED'
  | 'CAR_UPDATED'
  | 'CAR_ACTIVATED'
  | 'CAR_DEACTIVATED'
  | 'CAR_DELETED'
  | 'CAR_MUTATION_CONFLICT'
  | 'CAR_OPERATION_FAILED';
export interface CarEvent {
  event: CarEventName;
  outcome: 'success' | 'failure';
  requestId?: string;
  operation: string;
}
export type CarEvents = (event: CarEvent) => void;
export function createCarEvents(
  write: (event: CarEvent & { timestamp: string }) => void,
): CarEvents {
  return (event) => {
    try {
      write({ ...event, timestamp: new Date().toISOString() });
    } catch {
      /* Logging must not affect inventory behavior. */
    }
  };
}
