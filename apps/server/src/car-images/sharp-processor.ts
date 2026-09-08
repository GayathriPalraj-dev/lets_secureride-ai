import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { imageLimits } from '../config/images.js';
import type { ImageProcessor } from './processor.js';

export function createSharpProcessor(): ImageProcessor {
  return {
    async process(body, declared) {
      if (
        body.byteLength < 12 ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(declared)
      )
        throw new Error('Invalid image');
      const image = sharp(body, {
        failOn: 'error',
        limitInputPixels: imageLimits.maxPixels,
      });
      const metadata = await image.metadata();
      const width = metadata.width ?? 0,
        height = metadata.height ?? 0;
      const actual =
        metadata.format === 'jpeg'
          ? 'image/jpeg'
          : metadata.format === 'png'
            ? 'image/png'
            : metadata.format === 'webp'
              ? 'image/webp'
              : '';
      if (
        actual !== declared ||
        width < imageLimits.minWidth ||
        height < imageLimits.minHeight ||
        width > imageLimits.maxDimension ||
        height > imageLimits.maxDimension ||
        width * height > imageLimits.maxPixels
      )
        throw new Error('Invalid image');
      const output = await image
        .rotate()
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
      return {
        body: output,
        width,
        height,
        contentType: 'image/webp',
        checksumSha256: createHash('sha256').update(output).digest('base64'),
      };
    },
  };
}
