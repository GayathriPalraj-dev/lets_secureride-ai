import { describe, expect, it } from 'vitest';
import { imageLimits, parseImageConfig } from '../config/images.js';
describe('car image configuration', () => {
  it('accepts complete configuration', () =>
    expect(
      parseImageConfig({
        AWS_REGION: 'ap-south-1',
        CAR_IMAGE_BUCKET: 'private-bucket',
        CAR_IMAGE_EVENT_SECRET: 'x'.repeat(32),
      }).AWS_REGION,
    ).toBe('ap-south-1'));
  it('rejects a missing region', () =>
    expect(() =>
      parseImageConfig({
        CAR_IMAGE_BUCKET: 'bucket',
        CAR_IMAGE_EVENT_SECRET: 'x'.repeat(32),
      }),
    ).toThrow());
  it('rejects a short bucket', () =>
    expect(() =>
      parseImageConfig({
        AWS_REGION: 'a',
        CAR_IMAGE_BUCKET: 'x',
        CAR_IMAGE_EVENT_SECRET: 'x'.repeat(32),
      }),
    ).toThrow());
  it('rejects a short event secret', () =>
    expect(() =>
      parseImageConfig({
        AWS_REGION: 'a',
        CAR_IMAGE_BUCKET: 'bucket',
        CAR_IMAGE_EVENT_SECRET: 'short',
      }),
    ).toThrow());
  it('caps source objects at eight MiB', () =>
    expect(imageLimits.maxBytes).toBe(8 * 1024 * 1024));
  it('caps each car at eight images', () =>
    expect(imageLimits.maxImages).toBe(8));
});
