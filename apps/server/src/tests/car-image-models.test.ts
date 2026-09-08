import { describe, expect, it } from 'vitest';
import { carImageSchema } from '../models/car-image.js';
import { carImageSetSchema } from '../models/car-image-set.js';
import { carImageScanEventSchema } from '../models/car-image-scan-event.js';
describe('car image models', () => {
  it('disables automatic image indexes', () =>
    expect(carImageSchema.get('autoIndex')).toBe(false));
  it('disables automatic image collection creation', () =>
    expect(carImageSchema.get('autoCreate')).toBe(false));
  it('uses strict throw mode for images', () =>
    expect(carImageSchema.get('strict')).toBe('throw'));
  it('defines seven image indexes', () =>
    expect(carImageSchema.indexes()).toHaveLength(7));
  it('protects public id as immutable', () =>
    expect(carImageSchema.path('publicId').options.immutable).toBe(true));
  it('limits the slot to seven', () =>
    expect(carImageSchema.path('slot').options.max).toBe(7));
  it('defaults image revision to zero', () =>
    expect(carImageSchema.path('revision').options.default).toBe(0));
  it('uses strict throw mode for image sets', () =>
    expect(carImageSetSchema.get('strict')).toBe('throw'));
  it('defines one image-set index', () =>
    expect(carImageSetSchema.indexes()).toHaveLength(1));
  it('limits image-set count to eight', () =>
    expect(carImageSetSchema.path('imageCount').options.max).toBe(8));
  it('uses strict throw mode for scan events', () =>
    expect(carImageScanEventSchema.get('strict')).toBe('throw'));
  it('defines two scan-event indexes', () =>
    expect(carImageScanEventSchema.indexes()).toHaveLength(2));
});
