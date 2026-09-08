export type CarImageEventName =
  | 'CAR_IMAGE_UPLOAD_AUTHORIZED'
  | 'CAR_IMAGE_UPLOAD_COMPLETED'
  | 'CAR_IMAGE_VERIFICATION_REQUESTED'
  | 'CAR_IMAGE_ACCEPTED'
  | 'CAR_IMAGE_REJECTED'
  | 'CAR_IMAGE_EXPIRED'
  | 'CAR_IMAGE_PRIMARY_CHANGED'
  | 'CAR_IMAGE_REMOVED'
  | 'CAR_IMAGE_PROVIDER_FAILED';
export type CarImageEvents = (event: {
  event: CarImageEventName;
  outcome: 'success' | 'failure';
  operation: string;
  requestId: string;
}) => void;
export const createCarImageEvents =
  (write: CarImageEvents): CarImageEvents =>
  (event) =>
    write(event);
