import type { CarImageStatus } from '@lets-secureride-ai/contracts';
const transitions: Record<CarImageStatus, readonly CarImageStatus[]> = {
  pending_upload: ['uploaded', 'expired', 'deleted'],
  uploaded: ['verification_pending', 'rejected', 'deleted'],
  verification_pending: ['ready', 'rejected', 'deleted'],
  ready: ['deleted'],
  rejected: [],
  expired: [],
  deleted: [],
};
export const canTransition = (from: CarImageStatus, to: CarImageStatus) =>
  transitions[from].includes(to);
export function requireTransition(from: CarImageStatus, to: CarImageStatus) {
  if (from === to) return false;
  if (!canTransition(from, to)) throw new Error('Invalid car image transition');
  return true;
}
