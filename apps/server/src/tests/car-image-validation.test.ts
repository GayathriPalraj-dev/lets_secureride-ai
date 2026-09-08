import { describe, expect, it } from 'vitest';
import {
  parseRevision,
  scanEventSchema,
  updateImageSchema,
  uploadSchema,
} from '../car-images/validation.js';
const upload = {
  contentType: 'image/jpeg',
  size: 1024,
  checksumSha256: 'A'.repeat(43) + '=',
  altText: 'Front view',
};
describe('car image validation', () => {
  it('accepts a JPEG upload', () =>
    expect(uploadSchema.safeParse(upload).success).toBe(true));
  it('accepts PNG', () =>
    expect(
      uploadSchema.safeParse({ ...upload, contentType: 'image/png' }).success,
    ).toBe(true));
  it('accepts WebP', () =>
    expect(
      uploadSchema.safeParse({ ...upload, contentType: 'image/webp' }).success,
    ).toBe(true));
  it('rejects GIF', () =>
    expect(
      uploadSchema.safeParse({ ...upload, contentType: 'image/gif' }).success,
    ).toBe(false));
  it('rejects zero bytes', () =>
    expect(uploadSchema.safeParse({ ...upload, size: 0 }).success).toBe(false));
  it('rejects more than eight MiB', () =>
    expect(uploadSchema.safeParse({ ...upload, size: 8_388_609 }).success).toBe(
      false,
    ));
  it('rejects malformed checksums', () =>
    expect(
      uploadSchema.safeParse({ ...upload, checksumSha256: 'bad' }).success,
    ).toBe(false));
  it('rejects control characters in alt text', () =>
    expect(
      uploadSchema.safeParse({ ...upload, altText: 'bad\ntext' }).success,
    ).toBe(false));
  it('accepts an alt text update', () =>
    expect(updateImageSchema.safeParse({ altText: 'Side view' }).success).toBe(
      true,
    ));
  it('rejects empty updates', () =>
    expect(updateImageSchema.safeParse({}).success).toBe(false));
  it('accepts a strict scan event', () =>
    expect(
      scanEventSchema.safeParse({
        providerEventId: 'evt',
        imageId: '72b7b3ad-62a2-4f3d-8ee1-eabcf120eb2c',
        eventTime: '2026-01-01T00:00:00.000Z',
        outcome: 'clean',
      }).success,
    ).toBe(true));
  it('requires quoted revisions', () => {
    expect(parseRevision('"4"')).toBe(4);
    expect(() => parseRevision('4')).toThrow();
  });
});
