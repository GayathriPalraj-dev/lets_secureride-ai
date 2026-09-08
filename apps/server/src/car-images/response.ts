import type { AdminCarImage, CarImage } from '@lets-secureride-ai/contracts';
import type { ImageRecord } from './types.js';
export const toAdminImage = (x: ImageRecord): AdminCarImage => ({
  id: x.id,
  altText: x.altText,
  displayOrder: x.displayOrder,
  isPrimary: x.isPrimary,
  status: x.status,
  scanState: x.scanState,
  failureCategory: x.failureCategory,
  revision: x.revision,
  uploadExpiresAt: x.uploadExpiresAt.toISOString(),
  completedAt: x.completedAt?.toISOString() ?? null,
  verifiedAt: x.verifiedAt?.toISOString() ?? null,
  createdAt: x.createdAt.toISOString(),
  updatedAt: x.updatedAt.toISOString(),
});
export const toCustomerImage = (x: ImageRecord): CarImage => ({
  id: x.id,
  altText: x.altText,
  displayOrder: x.displayOrder,
  isPrimary: x.isPrimary,
  contentUrl: `/api/v1/cars/${encodeURIComponent(x.carId)}/images/${encodeURIComponent(x.id)}/content`,
  width: x.width!,
  height: x.height!,
});
