import type { ClientSession } from 'mongoose';
import type { createCarImageModel } from '../models/car-image.js';
import type { createCarImageSetModel } from '../models/car-image-set.js';
import type { createCarImageScanEventModel } from '../models/car-image-scan-event.js';
import type { ImageRecord, ScanEvent } from './types.js';

export interface ImageModels {
  images: ReturnType<typeof createCarImageModel>;
  sets: ReturnType<typeof createCarImageSetModel>;
  events: ReturnType<typeof createCarImageScanEventModel>;
}
export type ImageMutation =
  { result: 'updated'; image: ImageRecord } | { result: 'missing' | 'stale' };
export type ScanClaim =
  | { result: 'claimed'; image: ImageRecord }
  | { result: 'duplicate' | 'ignored' };
export interface ImageSetRecord {
  revision: number;
  imageCount: number;
  primaryImageId: string | null;
}
export interface ImageRepository {
  transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T>;
  set(carId: string): Promise<ImageSetRecord>;
  reserve(
    carId: string,
    expectedRevision: number,
    value: Omit<
      ImageRecord,
      'id' | 'slot' | 'displayOrder' | 'createdAt' | 'updatedAt'
    > & { publicId: string },
    session: ClientSession,
  ): Promise<{ image: ImageRecord; setRevision: number }>;
  list(carId: string, admin?: boolean): Promise<ImageRecord[]>;
  find(
    carId: string,
    imageId: string,
    admin?: boolean,
  ): Promise<ImageRecord | null>;
  update(
    carId: string,
    imageId: string,
    revision: number,
    set: Partial<ImageRecord>,
    session?: ClientSession,
  ): Promise<ImageMutation>;
  updateMetadata(
    carId: string,
    imageId: string,
    revision: number,
    set: { altText?: string; displayOrder?: number },
  ): Promise<ImageMutation>;
  makePrimary(
    carId: string,
    imageId: string,
    revision: number,
    session: ClientSession,
  ): Promise<ImageMutation>;
  release(
    carId: string,
    imageId: string,
    revision: number,
    session: ClientSession,
  ): Promise<ImageMutation>;
  markReconciliation(
    carId: string,
    imageId: string,
    revision: number,
  ): Promise<void>;
  claimScanEvent(event: ScanEvent, session: ClientSession): Promise<ScanClaim>;
  finalizeScan(
    image: ImageRecord,
    event: ScanEvent,
    set: Partial<ImageRecord>,
    session: ClientSession,
  ): Promise<ImageMutation>;
  hasLive(carId: string): Promise<boolean>;
}
type Lean = Record<string, unknown> & { _id: { toString(): string } };
const date = (value: unknown) =>
  value instanceof Date ? value : new Date(String(value));
export function mapImageRecord(row: Lean): ImageRecord {
  return {
    id: String(row.publicId),
    carId: String(row.carId),
    slot: Number(row.slot),
    quarantineObjectKey: String(row.quarantineObjectKey),
    quarantineVersionId:
      typeof row.quarantineVersionId === 'string'
        ? row.quarantineVersionId
        : null,
    readyObjectKey:
      typeof row.readyObjectKey === 'string' ? row.readyObjectKey : null,
    readyVersionId:
      typeof row.readyVersionId === 'string' ? row.readyVersionId : null,
    declaredContentType:
      row.declaredContentType as ImageRecord['declaredContentType'],
    normalizedContentType:
      row.normalizedContentType as ImageRecord['normalizedContentType'],
    expectedSize: Number(row.expectedSize),
    encodedSize: row.encodedSize == null ? null : Number(row.encodedSize),
    expectedChecksumSha256: String(row.expectedChecksumSha256),
    trustedChecksumSha256:
      typeof row.trustedChecksumSha256 === 'string'
        ? row.trustedChecksumSha256
        : null,
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    altText: String(row.altText),
    displayOrder: Number(row.displayOrder),
    isPrimary: Boolean(row.isPrimary),
    status: row.status as ImageRecord['status'],
    scanState: row.scanState as ImageRecord['scanState'],
    reconciliationState: (row.reconciliationState ??
      'none') as ImageRecord['reconciliationState'],
    failureCategory: row.failureCategory as ImageRecord['failureCategory'],
    lastScanEventTime: row.lastScanEventTime
      ? date(row.lastScanEventTime)
      : null,
    lastScanProviderEventId:
      typeof row.lastScanProviderEventId === 'string'
        ? row.lastScanProviderEventId
        : null,
    revision: Number(row.revision),
    uploadExpiresAt: date(row.uploadExpiresAt),
    scanExpiresAt: date(row.scanExpiresAt),
    completedAt: row.completedAt ? date(row.completedAt) : null,
    verifiedAt: row.verifiedAt ? date(row.verifiedAt) : null,
    deletedAt: row.deletedAt ? date(row.deletedAt) : null,
    createdAt: date(row.createdAt),
    updatedAt: date(row.updatedAt),
  };
}
export function isImageDuplicate(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
export function availableImageSlot(slots: readonly number[]): number | null {
  const used = new Set(slots);
  for (let slot = 0; slot < 8; slot++) if (!used.has(slot)) return slot;
  return null;
}
export function isNewerScanEvent(
  event: Pick<ScanEvent, 'eventTime' | 'providerEventId'>,
  previousTime: Date | null,
  previousId: string | null,
): boolean {
  if (Number.isNaN(event.eventTime.getTime())) return false;
  if (!previousTime) return true;
  const delta = event.eventTime.getTime() - previousTime.getTime();
  return (
    delta > 0 || (delta === 0 && event.providerEventId > (previousId ?? ''))
  );
}
const setMap = (row: Record<string, unknown> | null): ImageSetRecord => ({
  revision: row ? Number(row.revision) : 0,
  imageCount: row ? Number(row.imageCount) : 0,
  primaryImageId: row?.primaryImageId ? String(row.primaryImageId) : null,
});
export function createImageRepository(models: ImageModels): ImageRepository {
  const classify = async (
    carId: string,
    imageId: string,
  ): Promise<ImageMutation> => {
    const found = await models.images
      .findOne({ publicId: imageId, carId, deletedAt: null })
      .select('revision')
      .lean();
    return { result: found ? 'stale' : 'missing' };
  };
  return {
    async transaction(work) {
      const session = await models.images.db.startSession();
      try {
        const result = await session.withTransaction(() => work(session));
        if (result === undefined)
          throw new Error('Image transaction did not commit');
        return result;
      } finally {
        await session.endSession();
      }
    },
    async set(carId) {
      return setMap(
        (await models.sets.findOne({ carId }).lean()) as Record<
          string,
          unknown
        > | null,
      );
    },
    async reserve(carId, expectedRevision, value, session) {
      let current = await models.sets
        .findOne({ carId })
        .session(session)
        .lean();
      if (!current) {
        if (expectedRevision !== 0) throw new Error('CAR_IMAGE_SET_STALE');
        try {
          const rows = await models.sets.create(
            [{ carId, imageCount: 0, primaryImageId: null, revision: 0 }],
            { session },
          );
          current = rows[0]!.toObject();
        } catch (error) {
          if (isImageDuplicate(error))
            throw new Error('CAR_IMAGE_SET_STALE', { cause: error });
          throw error;
        }
      }
      if (Number(current.revision) !== expectedRevision)
        throw new Error('CAR_IMAGE_SET_STALE');
      if (Number(current.imageCount) >= 8) throw new Error('CAR_IMAGE_LIMIT');
      const occupied = await models.images
        .find({
          carId,
          deletedAt: null,
          status: { $nin: ['deleted', 'expired', 'rejected'] },
        })
        .select('slot')
        .session(session)
        .lean();
      const used = new Set(occupied.map((row) => Number(row.slot)));
      let slot = -1;
      for (let candidate = 0; candidate < 8; candidate++) {
        if (!used.has(candidate)) {
          slot = candidate;
          break;
        }
      }
      if (slot < 0) throw new Error('CAR_IMAGE_LIMIT');
      const changed = await models.sets
        .findOneAndUpdate(
          { carId, revision: expectedRevision, imageCount: { $lt: 8 } },
          { $inc: { imageCount: 1, revision: 1 } },
          { new: true, session, runValidators: true },
        )
        .lean();
      if (!changed) throw new Error('CAR_IMAGE_SET_STALE');
      try {
        const rows = await models.images.create(
          [{ ...value, carId, slot, displayOrder: slot }],
          { session },
        );
        return {
          image: mapImageRecord(rows[0]!.toObject() as Lean),
          setRevision: Number(changed.revision),
        };
      } catch (error) {
        if (isImageDuplicate(error))
          throw new Error('CAR_IMAGE_SET_STALE', { cause: error });
        throw error;
      }
    },
    async list(carId, admin = false) {
      const filter: Record<string, unknown> = { carId, deletedAt: null };
      if (!admin) filter.status = 'ready';
      const rows = await models.images
        .find(filter)
        .sort({ displayOrder: 1, _id: 1 })
        .lean();
      return rows.map((row) => mapImageRecord(row as Lean));
    },
    async find(carId, imageId, admin = false) {
      const filter: Record<string, unknown> = {
        publicId: imageId,
        deletedAt: null,
      };
      if (carId) filter.carId = carId;
      if (!admin) filter.status = 'ready';
      const row = await models.images.findOne(filter).lean();
      return row ? mapImageRecord(row as Lean) : null;
    },
    async update(carId, imageId, revision, set, session) {
      const row = await models.images
        .findOneAndUpdate(
          { carId, publicId: imageId, revision, deletedAt: null },
          { $set: set, $inc: { revision: 1 } },
          { new: true, runValidators: true, ...(session ? { session } : {}) },
        )
        .lean();
      return row
        ? { result: 'updated', image: mapImageRecord(row as Lean) }
        : classify(carId, imageId);
    },
    async updateMetadata(carId, imageId, revision, set) {
      return this.transaction(async (session) => {
        const target = await models.images
          .findOne({ carId, publicId: imageId, revision, deletedAt: null })
          .session(session)
          .lean();
        if (!target) return classify(carId, imageId);
        if (
          set.displayOrder !== undefined &&
          set.displayOrder !== Number(target.displayOrder)
        ) {
          const occupant = await models.images
            .findOne({ carId, displayOrder: set.displayOrder, deletedAt: null })
            .session(session)
            .lean();
          await models.images.updateOne(
            { _id: target._id },
            { $set: { displayOrder: -1 } },
            { session },
          );
          if (occupant)
            await models.images.updateOne(
              { _id: occupant._id },
              {
                $set: { displayOrder: Number(target.displayOrder) },
                $inc: { revision: 1 },
              },
              { session },
            );
        }
        const row = await models.images
          .findOneAndUpdate(
            { _id: target._id, revision },
            { $set: set, $inc: { revision: 1 } },
            { new: true, session, runValidators: true },
          )
          .lean();
        return row
          ? { result: 'updated', image: mapImageRecord(row as Lean) }
          : { result: 'stale' };
      });
    },
    async makePrimary(carId, imageId, revision, session) {
      const target = await models.images
        .findOne({
          carId,
          publicId: imageId,
          revision,
          status: 'ready',
          deletedAt: null,
        })
        .session(session)
        .lean();
      if (!target) return classify(carId, imageId);
      await models.images.updateMany(
        { carId, isPrimary: true, deletedAt: null },
        { $set: { isPrimary: false }, $inc: { revision: 1 } },
        { session },
      );
      const row = await models.images
        .findOneAndUpdate(
          { _id: target._id, revision },
          { $set: { isPrimary: true }, $inc: { revision: 1 } },
          { new: true, session },
        )
        .lean();
      if (row)
        await models.sets.updateOne(
          { carId },
          { $set: { primaryImageId: row._id }, $inc: { revision: 1 } },
          { session },
        );
      return row
        ? { result: 'updated', image: mapImageRecord(row as Lean) }
        : { result: 'stale' };
    },
    async release(carId, imageId, revision, session) {
      const current = await models.images
        .findOne({ carId, publicId: imageId, revision, deletedAt: null })
        .session(session)
        .lean();
      if (!current) return classify(carId, imageId);
      const row = await models.images
        .findOneAndUpdate(
          { _id: current._id, revision },
          {
            $set: {
              status: 'deleted',
              deletedAt: new Date(),
              isPrimary: false,
            },
            $inc: { revision: 1 },
          },
          { new: true, session },
        )
        .lean();
      if (!row) return { result: 'stale' };
      const update: Record<string, unknown> = {
        $inc: { imageCount: -1, revision: 1 },
      };
      if (current.isPrimary) {
        const replacement = await models.images
          .findOne({
            carId,
            _id: { $ne: current._id },
            status: 'ready',
            deletedAt: null,
          })
          .sort({ displayOrder: 1, _id: 1 })
          .session(session)
          .lean();
        if (replacement) {
          await models.images.updateOne(
            { _id: replacement._id },
            { $set: { isPrimary: true }, $inc: { revision: 1 } },
            { session },
          );
          update.$set = { primaryImageId: replacement._id };
        } else update.$set = { primaryImageId: null };
      }
      await models.sets.updateOne({ carId }, update, { session });
      return { result: 'updated', image: mapImageRecord(row as Lean) };
    },
    async markReconciliation(carId, imageId, revision) {
      await models.images.updateOne(
        {
          carId,
          publicId: imageId,
          revision,
          status: 'deleted',
          deletedAt: { $ne: null },
        },
        { $set: { reconciliationState: 'required' }, $inc: { revision: 1 } },
      );
    },
    async claimScanEvent(event, session) {
      try {
        await models.events.create([{ ...event }], { session });
      } catch (error) {
        if (isImageDuplicate(error)) return { result: 'duplicate' };
        throw error;
      }
      const current = await models.images
        .findOne({ publicId: event.imageId, deletedAt: null })
        .session(session)
        .lean();
      if (
        !current ||
        !['uploaded', 'verification_pending'].includes(String(current.status))
      )
        return { result: 'ignored' };
      const previousTime = current.lastScanEventTime
          ? date(current.lastScanEventTime)
          : null,
        previousId = String(current.lastScanProviderEventId ?? '');
      if (!isNewerScanEvent(event, previousTime, previousId))
        return { result: 'ignored' };
      const filter: Record<string, unknown> = {
        _id: current._id,
        revision: current.revision,
        status: { $in: ['uploaded', 'verification_pending'] },
      };
      if (previousTime) {
        filter.lastScanEventTime = previousTime;
        filter.lastScanProviderEventId = previousId;
      } else filter.lastScanEventTime = null;
      const row = await models.images
        .findOneAndUpdate(
          filter,
          {
            $set: {
              status: 'verification_pending',
              lastScanEventTime: event.eventTime,
              lastScanProviderEventId: event.providerEventId,
            },
            $inc: { revision: 1 },
          },
          { new: true, session },
        )
        .lean();
      return row
        ? { result: 'claimed', image: mapImageRecord(row as Lean) }
        : { result: 'ignored' };
    },
    async finalizeScan(image, event, set, session) {
      const row = await models.images
        .findOneAndUpdate(
          {
            carId: image.carId,
            publicId: image.id,
            revision: image.revision,
            status: 'verification_pending',
            lastScanEventTime: event.eventTime,
            lastScanProviderEventId: event.providerEventId,
          },
          { $set: set, $inc: { revision: 1 } },
          { new: true, session, runValidators: true },
        )
        .lean();
      return row
        ? { result: 'updated', image: mapImageRecord(row as Lean) }
        : { result: 'stale' };
    },
    async hasLive(carId) {
      return Boolean(
        await models.images.exists({
          carId,
          deletedAt: null,
          status: { $nin: ['deleted', 'expired', 'rejected'] },
        }),
      );
    },
  };
}
