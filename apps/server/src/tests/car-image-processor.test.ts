import { beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createSharpProcessor } from '../car-images/sharp-processor.js';
let jpeg: Buffer, png: Buffer, webp: Buffer;
beforeAll(async () => {
  jpeg = await sharp({
    create: { width: 640, height: 360, channels: 3, background: 'red' },
  })
    .jpeg()
    .toBuffer();
  png = await sharp({
    create: { width: 640, height: 360, channels: 3, background: 'blue' },
  })
    .png()
    .toBuffer();
  webp = await sharp({
    create: { width: 640, height: 360, channels: 3, background: 'green' },
  })
    .webp()
    .toBuffer();
});
describe('secure image processor', () => {
  it('normalizes JPEG to WebP', async () =>
    expect(
      (await createSharpProcessor().process(jpeg, 'image/jpeg')).contentType,
    ).toBe('image/webp'));
  it('normalizes PNG to WebP', async () =>
    expect(
      (await createSharpProcessor().process(png, 'image/png')).contentType,
    ).toBe('image/webp'));
  it('normalizes WebP deterministically', async () =>
    expect(
      (await createSharpProcessor().process(webp, 'image/webp')).width,
    ).toBe(640));
  it('retains trusted height', async () =>
    expect(
      (await createSharpProcessor().process(jpeg, 'image/jpeg')).height,
    ).toBe(360));
  it('creates a base64 checksum', async () =>
    expect(
      (await createSharpProcessor().process(jpeg, 'image/jpeg')).checksumSha256,
    ).toMatch(/^[A-Za-z0-9+/]{43}=$/));
  it('rejects MIME mismatch', async () =>
    await expect(
      createSharpProcessor().process(png, 'image/jpeg'),
    ).rejects.toThrow());
  it('rejects unsupported MIME', async () =>
    await expect(
      createSharpProcessor().process(jpeg, 'image/gif'),
    ).rejects.toThrow());
  it('rejects truncated data', async () =>
    await expect(
      createSharpProcessor().process(new Uint8Array([1, 2, 3]), 'image/jpeg'),
    ).rejects.toThrow());
  it('rejects images narrower than 640', async () => {
    const b = await sharp({
      create: { width: 639, height: 360, channels: 3, background: 'red' },
    })
      .jpeg()
      .toBuffer();
    await expect(
      createSharpProcessor().process(b, 'image/jpeg'),
    ).rejects.toThrow();
  });
  it('rejects images shorter than 360', async () => {
    const b = await sharp({
      create: { width: 640, height: 359, channels: 3, background: 'red' },
    })
      .jpeg()
      .toBuffer();
    await expect(
      createSharpProcessor().process(b, 'image/jpeg'),
    ).rejects.toThrow();
  });
});
