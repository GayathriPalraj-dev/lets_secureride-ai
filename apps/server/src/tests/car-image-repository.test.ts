import { describe, expect, it } from 'vitest';
import {
  availableImageSlot,
  isImageDuplicate,
  isNewerScanEvent,
  mapImageRecord,
} from '../car-images/repository.js';
const row = {
  _id: { toString: () => 'mongo' },
  publicId: 'public',
  carId: 'car',
  slot: 2,
  quarantineObjectKey: 'q',
  quarantineVersionId: null,
  readyObjectKey: 'r',
  readyVersionId: 'v',
  declaredContentType: 'image/png',
  normalizedContentType: 'image/webp',
  expectedSize: 10,
  encodedSize: 8,
  expectedChecksumSha256: 'expected',
  trustedChecksumSha256: 'trusted',
  width: 640,
  height: 360,
  altText: 'Front',
  displayOrder: 2,
  isPrimary: true,
  status: 'ready',
  scanState: 'clean',
  reconciliationState: 'none',
  failureCategory: null,
  revision: 3,
  uploadExpiresAt: new Date('2026-01-01'),
  scanExpiresAt: new Date('2026-01-02'),
  completedAt: new Date('2026-01-01'),
  verifiedAt: new Date('2026-01-01'),
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};
describe('car image repository mapping', () => {
  it('uses the public id', () => expect(mapImageRecord(row).id).toBe('public'));
  it('maps car ownership', () => expect(mapImageRecord(row).carId).toBe('car'));
  it('maps immutable slot', () => expect(mapImageRecord(row).slot).toBe(2));
  it('allocates the first available occupancy slot', () =>
    expect(availableImageSlot([0, 2, 3])).toBe(1));
  it('rejects a ninth occupied slot', () =>
    expect(availableImageSlot([0, 1, 2, 3, 4, 5, 6, 7])).toBeNull());
  it('rejects an older scan decision', () =>
    expect(
      isNewerScanEvent(
        { providerEventId: 'event-z', eventTime: new Date('2025-12-31') },
        new Date('2026-01-01'),
        'event-a',
      ),
    ).toBe(false));
  it('orders equal scan timestamps by provider identity', () =>
    expect(
      isNewerScanEvent(
        { providerEventId: 'event-c', eventTime: new Date('2026-01-01') },
        new Date('2026-01-01'),
        'event-b',
      ),
    ).toBe(true));
  it('maps trusted dimensions', () =>
    expect([mapImageRecord(row).width, mapImageRecord(row).height]).toEqual([
      640, 360,
    ]));
  it('maps primary state', () =>
    expect(mapImageRecord(row).isPrimary).toBe(true));
  it('maps optimistic revision', () =>
    expect(mapImageRecord(row).revision).toBe(3));
  it('preserves date instances', () =>
    expect(mapImageRecord(row).createdAt).toBeInstanceOf(Date));
  it('defaults missing reconciliation state', () =>
    expect(
      mapImageRecord({ ...row, reconciliationState: undefined })
        .reconciliationState,
    ).toBe('none'));
  it('recognizes Mongo duplicate-key failures', () =>
    expect(isImageDuplicate({ code: 11000 })).toBe(true));
  it('does not misclassify ordinary failures', () =>
    expect(isImageDuplicate(new Error('no'))).toBe(false));
});
