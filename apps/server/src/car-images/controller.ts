import type { RequestHandler, Response } from 'express';
import type { CarImageService } from './service.js';
import {
  imageIdSchema,
  parseRevision,
  updateImageSchema,
  uploadSchema,
} from './validation.js';
import { AppError } from '../utils/app-error.js';

const imageId = (value: unknown) => parsed(imageIdSchema, value);

const carId = (value: unknown) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{24}$/i.test(value))
    throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed');
  return value;
};
const parsed = <T>(
  schema: { safeParse(value: unknown): { success: boolean; data?: T } },
  value: unknown,
): T => {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed');
  return result.data as T;
};
const ok = (res: Response, requestId: string, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, requestId });
const etag = (res: Response, revision: number) =>
  res.setHeader('ETag', `"${revision}"`);
export function createCarImageController(service: CarImageService) {
  const wrap =
    (
      work: (
        req: Parameters<RequestHandler>[0],
        res: Response,
      ) => Promise<void>,
    ): RequestHandler =>
    async (req, res, next) => {
      try {
        await work(req, res);
      } catch (error) {
        next(error);
      }
    };
  return {
    customerList: wrap(async (req, res) => {
      ok(res, req.requestId, {
        items: await service.customerList(carId(req.params.carId)),
      });
    }),
    adminList: wrap(async (req, res) => {
      const data = await service.adminList(carId(req.params.carId));
      etag(res, data.revision);
      ok(res, req.requestId, data);
    }),
    authorize: wrap(async (req, res) => {
      const data = await service.authorize(
        carId(req.params.carId),
        parseRevision(req.headers['if-match']),
        parsed(uploadSchema, req.body),
        req.requestId,
      );
      etag(res, data.image.revision);
      ok(res, req.requestId, data, 201);
    }),
    complete: wrap(async (req, res) => {
      const image = await service.complete(
        carId(req.params.carId),
        imageId(req.params.imageId),
        parseRevision(req.headers['if-match']),
        req.requestId,
      );
      etag(res, image.revision);
      ok(res, req.requestId, { image });
    }),
    update: wrap(async (req, res) => {
      const image = await service.update(
        carId(req.params.carId),
        imageId(req.params.imageId),
        parseRevision(req.headers['if-match']),
        parsed(
          updateImageSchema,
          req.body,
        ) as import('@lets-secureride-ai/contracts').UpdateCarImageRequest,
        req.requestId,
      );
      etag(res, image.revision);
      ok(res, req.requestId, { image });
    }),
    primary: wrap(async (req, res) => {
      parsed(
        {
          safeParse: (v: unknown) => ({
            success: Boolean(
              v && typeof v === 'object' && Object.keys(v).length === 0,
            ),
            data: v,
          }),
        },
        req.body,
      );
      const image = await service.primary(
        carId(req.params.carId),
        imageId(req.params.imageId),
        parseRevision(req.headers['if-match']),
        req.requestId,
      );
      etag(res, image.revision);
      ok(res, req.requestId, { image });
    }),
    remove: wrap(async (req, res) => {
      const image = await service.remove(
        carId(req.params.carId),
        imageId(req.params.imageId),
        parseRevision(req.headers['if-match']),
        req.requestId,
      );
      etag(res, image.revision);
      ok(res, req.requestId, { image });
    }),
    content: wrap(async (req, res) => {
      const value = await service.content(
        carId(req.params.carId),
        imageId(req.params.imageId),
      );
      res.setHeader('Content-Type', value.contentType);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(Buffer.from(value.body));
    }),
  };
}
