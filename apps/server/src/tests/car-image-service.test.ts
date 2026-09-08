/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCarImageService } from '../car-images/service.js';
const now = new Date('2026-01-01T00:00:00Z');
const image = {
  id: '72b7b3ad-62a2-4f3d-8ee1-eabcf120eb2c',
  carId: '507f1f77bcf86cd799439011',
  slot: 0,
  quarantineObjectKey: 'q',
  quarantineVersionId: null,
  readyObjectKey: 'r',
  readyVersionId: null,
  declaredContentType: 'image/png' as const,
  normalizedContentType: 'image/webp' as const,
  expectedSize: 10,
  encodedSize: 8,
  expectedChecksumSha256: 'A'.repeat(43) + '=',
  trustedChecksumSha256: 'B'.repeat(43) + '=',
  width: 640,
  height: 360,
  altText: 'Front',
  displayOrder: 0,
  isPrimary: true,
  status: 'ready' as const,
  scanState: 'clean' as const,
  reconciliationState: 'none' as const,
  failureCategory: null,
  revision: 0,
  uploadExpiresAt: new Date('2026-01-01T00:05:00Z'),
  scanExpiresAt: new Date('2026-01-02'),
  completedAt: now,
  verifiedAt: now,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
};
let repo: any, storage: any, service: ReturnType<typeof createCarImageService>;
beforeEach(() => {
  repo = {
    transaction: vi.fn(async (f: any) => f({})),
    reserve: vi.fn().mockResolvedValue({
      image: {
        ...image,
        status: 'pending_upload',
        readyObjectKey: null,
        isPrimary: false,
      },
      setRevision: 1,
    }),
    list: vi.fn().mockResolvedValue([image]),
    set: vi.fn().mockResolvedValue({ revision: 0, imageCount: 1 }),
    find: vi.fn().mockResolvedValue(image),
    update: vi.fn().mockResolvedValue({
      result: 'updated',
      image: { ...image, revision: 1 },
    }),
    updateMetadata: vi.fn().mockResolvedValue({
      result: 'updated',
      image: { ...image, revision: 1 },
    }),
    makePrimary: vi.fn().mockResolvedValue({
      result: 'updated',
      image: { ...image, revision: 1 },
    }),
    release: vi.fn().mockResolvedValue({
      result: 'updated',
      image: { ...image, status: 'deleted', revision: 1 },
    }),
    markReconciliation: vi.fn().mockResolvedValue(undefined),
    hasLive: vi.fn().mockResolvedValue(true),
  };
  storage = {
    authorize: vi.fn().mockResolvedValue({
      url: 'https://upload.invalid',
      fields: { key: 'q' },
    }),
    head: vi.fn().mockResolvedValue({
      size: 10,
      checksum: image.expectedChecksumSha256,
      contentType: 'image/png',
      uploadId: image.id,
      versionId: 'v',
    }),
    read: vi.fn().mockResolvedValue(new Uint8Array([1])),
    writeReady: vi.fn(),
    remove: vi.fn(),
  };
  service = createCarImageService(
    repo,
    storage,
    { process: vi.fn() } as never,
    vi.fn(),
    { exists: vi.fn().mockResolvedValue(true) },
    () => now,
  );
});
describe('car image service', () => {
  it('lists customer-safe images', async () =>
    expect((await service.customerList(image.carId))[0]).not.toHaveProperty(
      'quarantineObjectKey',
    ));
  it('lists administrator state', async () =>
    expect((await service.adminList(image.carId)).items[0]?.status).toBe(
      'ready',
    ));
  it('reports the highest list revision', async () =>
    expect((await service.adminList(image.carId)).revision).toBe(0));
  it('rejects a missing car', async () => {
    service = createCarImageService(
      repo,
      storage,
      { process: vi.fn() } as never,
      vi.fn(),
      { exists: vi.fn().mockResolvedValue(false) },
      () => now,
    );
    await expect(service.customerList(image.carId)).rejects.toMatchObject({
      code: 'CAR_NOT_FOUND',
    });
  });
  it('authorizes exact upload fields', async () =>
    expect(
      (
        await service.authorize(
          image.carId,
          0,
          {
            contentType: 'image/png',
            size: 10,
            checksumSha256: image.expectedChecksumSha256,
            altText: 'Front',
          },
          'r',
        )
      ).upload.url,
    ).toBe('https://upload.invalid'));
  it('reserves authorization transactionally', async () => {
    await service.authorize(
      image.carId,
      0,
      {
        contentType: 'image/png',
        size: 10,
        checksumSha256: image.expectedChecksumSha256,
        altText: 'Front',
      },
      'r',
    );
    expect(repo.transaction).toHaveBeenCalledOnce();
  });
  it('enforces the eight-image slot limit', async () => {
    repo.reserve.mockRejectedValueOnce(new Error('CAR_IMAGE_LIMIT'));
    await expect(
      service.authorize(
        image.carId,
        8,
        {
          contentType: 'image/png',
          size: 10,
          checksumSha256: image.expectedChecksumSha256,
          altText: 'Front',
        },
        'r',
      ),
    ).rejects.toMatchObject({ code: 'CAR_IMAGE_LIMIT_REACHED' });
  });
  it('releases the reserved slot when provider authorization fails', async () => {
    storage.authorize.mockRejectedValue(new Error('private'));
    await expect(
      service.authorize(
        image.carId,
        0,
        {
          contentType: 'image/png',
          size: 10,
          checksumSha256: image.expectedChecksumSha256,
          altText: 'Front',
        },
        'r',
      ),
    ).rejects.toMatchObject({ code: 'CAR_IMAGE_SERVICE_UNAVAILABLE' });
    expect(repo.release).toHaveBeenCalledWith(
      image.carId,
      image.id,
      image.revision,
      expect.anything(),
    );
  });
  it('completes a matching upload', async () => {
    repo.find.mockResolvedValue({
      ...image,
      status: 'pending_upload',
      readyObjectKey: null,
      isPrimary: false,
    });
    expect(
      (await service.complete(image.carId, image.id, 0, 'r')).revision,
    ).toBe(1);
  });
  it('rejects stale completion', async () => {
    repo.find.mockResolvedValue({
      ...image,
      status: 'pending_upload',
      revision: 2,
    });
    await expect(
      service.complete(image.carId, image.id, 0, 'r'),
    ).rejects.toMatchObject({ code: 'CAR_IMAGE_STALE' });
  });
  it('rejects mismatched object metadata', async () => {
    repo.find.mockResolvedValue({
      ...image,
      status: 'pending_upload',
      readyObjectKey: null,
    });
    storage.head.mockResolvedValue({ ...(await storage.head()), size: 11 });
    await expect(
      service.complete(image.carId, image.id, 0, 'r'),
    ).rejects.toMatchObject({ code: 'CAR_IMAGE_UPLOAD_MISMATCH' });
  });
  it('updates alt text', async () =>
    expect(
      (await service.update(image.carId, image.id, 0, { altText: 'Side' }, 'r'))
        .revision,
    ).toBe(1));
  it('changes the primary image transactionally', async () => {
    await service.primary(image.carId, image.id, 0, 'r');
    expect(repo.transaction).toHaveBeenCalledOnce();
  });
  it('soft deletes then removes provider objects', async () => {
    await service.remove(image.carId, image.id, 0, 'r');
    expect(storage.remove).toHaveBeenCalledTimes(2);
  });
  it('marks reconciliation when provider deletion fails', async () => {
    storage.remove.mockRejectedValue(new Error('down'));
    await service.remove(image.carId, image.id, 0, 'r');
    expect(repo.markReconciliation).toHaveBeenCalledWith(
      image.carId,
      image.id,
      1,
    );
  });
  it('proxies only ready image bytes', async () =>
    expect((await service.content(image.carId, image.id)).contentType).toBe(
      'image/webp',
    ));
});
