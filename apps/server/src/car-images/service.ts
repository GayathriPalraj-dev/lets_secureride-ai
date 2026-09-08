import { randomUUID } from 'node:crypto';
import type {
  AdminCarImage,
  AdminCarImageListData,
  CarImage,
  CarImageUploadAuthorization,
  CreateCarImageUploadRequest,
  UpdateCarImageRequest,
} from '@lets-secureride-ai/contracts';
import { AppError } from '../utils/app-error.js';
import { imageLimits } from '../config/images.js';
import type { CarImageEvents } from './events.js';
import type { ImageProcessor } from './processor.js';
import type { ImageRepository, ImageMutation } from './repository.js';
import { toAdminImage, toCustomerImage } from './response.js';
import type { ImageStorage } from './storage.js';
export interface CarImageCarGuard {
  exists(carId: string, active?: boolean): Promise<boolean>;
}
const unavailable = () =>
  new AppError(
    503,
    'CAR_IMAGE_SERVICE_UNAVAILABLE',
    'Image service is temporarily unavailable',
  );
const missing = () =>
  new AppError(404, 'CAR_IMAGE_NOT_FOUND', 'Car image was not found');
const stale = () =>
  new AppError(412, 'CAR_IMAGE_STALE', 'Car image changed; reload and retry');
function changed(value: ImageMutation) {
  if (value.result === 'updated') return value.image;
  if (value.result === 'missing') throw missing();
  throw stale();
}
export function createCarImageService(
  repository: ImageRepository,
  storage: ImageStorage,
  processor: ImageProcessor,
  events: CarImageEvents,
  cars: CarImageCarGuard,
  now = () => new Date(),
) {
  const emit = (
    event: Parameters<CarImageEvents>[0]['event'],
    requestId: string,
    operation: string,
    outcome: 'success' | 'failure' = 'success',
  ) => events({ event, requestId, operation, outcome });
  const ensureCar = async (carId: string, active = false) => {
    if (!(await cars.exists(carId, active)))
      throw new AppError(404, 'CAR_NOT_FOUND', 'Car was not found');
  };
  return {
    async customerList(carId: string): Promise<CarImage[]> {
      await ensureCar(carId, true);
      return (await repository.list(carId)).map(toCustomerImage);
    },
    async adminList(carId: string): Promise<AdminCarImageListData> {
      await ensureCar(carId);
      const [records, set] = await Promise.all([
        repository.list(carId, true),
        repository.set(carId),
      ]);
      return { items: records.map(toAdminImage), revision: set.revision };
    },
    async authorize(
      carId: string,
      revision: number,
      value: CreateCarImageUploadRequest,
      requestId: string,
    ): Promise<CarImageUploadAuthorization> {
      await ensureCar(carId);
      const created = now(),
        id = randomUUID(),
        uploadExpiresAt = new Date(
          created.getTime() + imageLimits.uploadSeconds * 1000,
        ),
        scanExpiresAt = new Date(
          created.getTime() + imageLimits.scanSeconds * 1000,
        ),
        key = ['quarantine', carId, id].join('/');
      let image;
      try {
        const reservation = await repository.transaction((session) =>
          repository.reserve(
            carId,
            revision,
            {
              publicId: id,
              carId,
              quarantineObjectKey: key,
              quarantineVersionId: null,
              readyObjectKey: null,
              readyVersionId: null,
              declaredContentType: value.contentType,
              normalizedContentType: null,
              expectedSize: value.size,
              encodedSize: null,
              expectedChecksumSha256: value.checksumSha256,
              trustedChecksumSha256: null,
              width: null,
              height: null,
              altText: value.altText,
              isPrimary: false,
              status: 'pending_upload',
              scanState: 'pending',
              reconciliationState: 'none',
              failureCategory: null,
              lastScanEventTime: null,
              lastScanProviderEventId: null,
              revision: 0,
              uploadExpiresAt,
              scanExpiresAt,
              completedAt: null,
              verifiedAt: null,
              deletedAt: null,
            },
            session,
          ),
        );
        image = reservation.image;
      } catch (error) {
        if (error instanceof Error && error.message === 'CAR_IMAGE_LIMIT')
          throw new AppError(
            409,
            'CAR_IMAGE_LIMIT_REACHED',
            'Car image limit reached',
          );
        if (error instanceof Error && error.message === 'CAR_IMAGE_SET_STALE')
          throw stale();
        throw unavailable();
      }
      try {
        const upload = await storage.authorize({
          key,
          contentType: value.contentType,
          size: value.size,
          checksum: value.checksumSha256,
          uploadId: id,
          expiresAt: uploadExpiresAt,
        });
        emit('CAR_IMAGE_UPLOAD_AUTHORIZED', requestId, 'authorize');
        return {
          image: toAdminImage(image),
          upload: { ...upload, expiresAt: uploadExpiresAt.toISOString() },
        };
      } catch {
        try {
          await repository.transaction((session) =>
            repository.release(carId, image.id, image.revision, session),
          );
        } catch {
          /* reconciliation retains the failed reservation for safe cleanup */
        }
        emit('CAR_IMAGE_PROVIDER_FAILED', requestId, 'authorize', 'failure');
        throw unavailable();
      }
    },
    async complete(
      carId: string,
      imageId: string,
      revision: number,
      requestId: string,
    ): Promise<AdminCarImage> {
      await ensureCar(carId);
      const image = await repository.find(carId, imageId, true);
      if (!image) throw missing();
      if (image.revision !== revision) throw stale();
      if (image.status !== 'pending_upload')
        throw new AppError(
          409,
          'CAR_IMAGE_INVALID_TRANSITION',
          'Car image state does not allow this action',
        );
      if (image.uploadExpiresAt <= now())
        throw new AppError(
          409,
          'CAR_IMAGE_UPLOAD_EXPIRED',
          'Upload authorization expired',
        );
      let object;
      try {
        object = await storage.head(image.quarantineObjectKey);
      } catch {
        throw unavailable();
      }
      if (
        !object ||
        object.size !== image.expectedSize ||
        object.checksum !== image.expectedChecksumSha256 ||
        object.contentType !== image.declaredContentType ||
        object.uploadId !== image.id
      )
        throw new AppError(
          422,
          'CAR_IMAGE_UPLOAD_MISMATCH',
          'Uploaded object did not match authorization',
        );
      const updated = changed(
        await repository.update(carId, imageId, revision, {
          status: 'uploaded',
          quarantineVersionId: object.versionId,
          completedAt: now(),
        }),
      );
      emit('CAR_IMAGE_UPLOAD_COMPLETED', requestId, 'complete');
      return toAdminImage(updated);
    },
    async update(
      carId: string,
      imageId: string,
      revision: number,
      value: UpdateCarImageRequest,
      requestId: string,
    ): Promise<AdminCarImage> {
      await ensureCar(carId);
      const image = changed(
        await repository.updateMetadata(carId, imageId, revision, value),
      );
      emit('CAR_IMAGE_PRIMARY_CHANGED', requestId, 'update');
      return toAdminImage(image);
    },
    async primary(
      carId: string,
      imageId: string,
      revision: number,
      requestId: string,
    ): Promise<AdminCarImage> {
      await ensureCar(carId);
      const image = await repository.transaction((session) =>
        repository.makePrimary(carId, imageId, revision, session).then(changed),
      );
      emit('CAR_IMAGE_PRIMARY_CHANGED', requestId, 'primary');
      return toAdminImage(image);
    },
    async remove(
      carId: string,
      imageId: string,
      revision: number,
      requestId: string,
    ): Promise<AdminCarImage> {
      await ensureCar(carId);
      const current = await repository.find(carId, imageId, true);
      if (!current) throw missing();
      const image = await repository.transaction((session) =>
        repository.release(carId, imageId, revision, session).then(changed),
      );
      try {
        await Promise.all([
          storage.remove(
            current.quarantineObjectKey,
            current.quarantineVersionId,
          ),
          ...(current.readyObjectKey
            ? [storage.remove(current.readyObjectKey, current.readyVersionId)]
            : []),
        ]);
      } catch {
        await repository.markReconciliation(carId, imageId, image.revision);
      }
      emit('CAR_IMAGE_REMOVED', requestId, 'remove');
      return toAdminImage(image);
    },
    async content(
      carId: string,
      imageId: string,
    ): Promise<{ body: Uint8Array; contentType: 'image/webp' }> {
      await ensureCar(carId, true);
      const image = await repository.find(carId, imageId);
      if (!image || !image.readyObjectKey) throw missing();
      try {
        return {
          body: await storage.read(image.readyObjectKey, image.readyVersionId),
          contentType: 'image/webp',
        };
      } catch {
        throw unavailable();
      }
    },
    processor,
  };
}
export type CarImageService = ReturnType<typeof createCarImageService>;
