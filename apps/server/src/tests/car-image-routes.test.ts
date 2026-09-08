/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { carImagesRouter } from '../routes/car-images.js';
import { createCarImageController } from '../car-images/controller.js';
const handler = (..._args: unknown[]) => undefined;
const router = () =>
  carImagesRouter({
    auth: {} as never,
    service: {} as never,
    authorizationEvents: vi.fn(),
    origin: 'http://localhost:5173',
    limit: () => handler,
  });
const routes = () =>
  router()
    .stack.filter((layer: any) => layer.route)
    .map((layer: any) => ({
      path: layer.route.path,
      methods: layer.route.methods,
    }));
describe('car image routes', () => {
  it('registers eight image endpoints', () => expect(routes()).toHaveLength(8));
  it('lists customer images', () =>
    expect(routes()).toContainEqual(
      expect.objectContaining({
        path: '/cars/:carId/images',
        methods: expect.objectContaining({ get: true }),
      }),
    ));
  it('proxies customer content', () =>
    expect(routes()).toContainEqual(
      expect.objectContaining({ path: '/cars/:carId/images/:imageId/content' }),
    ));
  it('lists administrator images', () =>
    expect(routes()).toContainEqual(
      expect.objectContaining({
        path: '/admin/cars/:carId/images',
        methods: expect.objectContaining({ get: true }),
      }),
    ));
  it('authorizes uploads with POST', () =>
    expect(routes()).toContainEqual(
      expect.objectContaining({
        path: '/admin/cars/:carId/images/uploads',
        methods: expect.objectContaining({ post: true }),
      }),
    ));
  it('completes uploads with POST', () =>
    expect(routes()).toContainEqual(
      expect.objectContaining({
        path: '/admin/cars/:carId/images/:imageId/complete',
      }),
    ));
  it('updates metadata with PATCH', () =>
    expect(routes()).toContainEqual(
      expect.objectContaining({
        methods: expect.objectContaining({ patch: true }),
      }),
    ));
  it('sets primary images with POST', () =>
    expect(routes()).toContainEqual(
      expect.objectContaining({
        path: '/admin/cars/:carId/images/:imageId/primary',
      }),
    ));
  it('removes images with DELETE', () =>
    expect(routes()).toContainEqual(
      expect.objectContaining({
        methods: expect.objectContaining({ delete: true }),
      }),
    ));
  it('uses the upload limiter category', () => {
    const limit = vi.fn(() => handler);
    carImagesRouter({
      auth: {} as never,
      service: {} as never,
      authorizationEvents: vi.fn(),
      origin: 'http://localhost:5173',
      limit,
    });
    expect(limit).toHaveBeenCalledWith('upload');
  });
  it('uses the completion limiter category', () => {
    const limit = vi.fn(() => handler);
    carImagesRouter({
      auth: {} as never,
      service: {} as never,
      authorizationEvents: vi.fn(),
      origin: 'http://localhost:5173',
      limit,
    });
    expect(limit).toHaveBeenCalledWith('complete');
  });
  it('uses management throttling', () => {
    const limit = vi.fn(() => handler);
    carImagesRouter({
      auth: {} as never,
      service: {} as never,
      authorizationEvents: vi.fn(),
      origin: 'http://localhost:5173',
      limit,
    });
    expect(limit).toHaveBeenCalledWith('manage');
  });
  it('uses read throttling', () => {
    const limit = vi.fn(() => handler);
    carImagesRouter({
      auth: {} as never,
      service: {} as never,
      authorizationEvents: vi.fn(),
      origin: 'http://localhost:5173',
      limit,
    });
    expect(limit).toHaveBeenCalledWith('read');
  });
  it('accepts canonical UUIDs and rejects malformed image IDs before service access', async () => {
    const complete = vi.fn().mockResolvedValue({ revision: 1 });
    const controller = createCarImageController({ complete } as never);
    const response = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const request = (imageId: string) =>
      ({
        params: { carId: '507f1f77bcf86cd799439011', imageId },
        headers: { 'if-match': '"0"' },
        requestId: 'request',
      }) as never;
    controller.complete(
      request('72b7b3ad-62a2-4f3d-8ee1-eabcf120eb2c'),
      response as never,
      vi.fn(),
    );
    await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce());

    for (const invalid of [
      '72b7b3ad62a2-4f3d-8ee1-eabcf120eb2c',
      '72b7b3ad-62a2-4f3d-8ee1-eabcf120eb2z',
      '72b7b3ad',
      '72b7b3ad-62a2-4f3d-8ee1-eabcf120eb2c00',
    ]) {
      const next = vi.fn();
      controller.complete(request(invalid), response as never, next);
      await vi.waitFor(() =>
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 400,
            code: 'VALIDATION_ERROR',
          }),
        ),
      );
    }
    expect(complete).toHaveBeenCalledOnce();
  });
});
