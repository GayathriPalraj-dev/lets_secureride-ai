import type { RequestHandler, Response } from 'express';
import type { CarService } from './service.js';
import {
  adminCarListQuerySchema,
  carListQuerySchema,
  createCarSchema,
  parseIfMatch,
  updateCarSchema,
  validateCar,
  validateCarId,
} from './validation.js';
import type {
  ParsedAdminCarListQuery,
  ParsedCarListQuery,
} from './repository.js';
import { allowCustomerCarDetail, allowCustomerCarSummary } from './response.js';

function success(
  res: Response,
  requestId: string,
  data: unknown,
  status = 200,
) {
  res.status(status).json({ success: true, data, requestId });
}
function etag(res: Response, car: { revision: number }) {
  res.setHeader('ETag', `"${car.revision}"`);
}
export function createCarController(service: CarService) {
  const wrap =
    (
      operation: (
        req: Parameters<RequestHandler>[0],
        res: Response,
      ) => Promise<void>,
    ): RequestHandler =>
    async (req, res, next) => {
      try {
        await operation(req, res);
      } catch (error) {
        next(error);
      }
    };
  return {
    list: wrap(async (req, res) => {
      const result = await service.list(
        validateCar(carListQuerySchema, req.query) as ParsedCarListQuery,
        req.requestId,
      );
      success(res, req.requestId, {
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        items: result.items.map(allowCustomerCarSummary),
      });
    }),
    detail: wrap(async (req, res) => {
      const car = await service.detail(
        validateCarId(req.params.carId),
        req.requestId,
      );
      success(res, req.requestId, { car: allowCustomerCarDetail(car) });
    }),
    adminList: wrap(async (req, res) =>
      success(
        res,
        req.requestId,
        await service.adminList(
          validateCar(
            adminCarListQuerySchema,
            req.query,
          ) as ParsedAdminCarListQuery,
          req.requestId,
        ),
      ),
    ),
    adminDetail: wrap(async (req, res) => {
      const car = await service.adminDetail(
        validateCarId(req.params.carId),
        req.requestId,
      );
      etag(res, car);
      success(res, req.requestId, { car });
    }),
    create: wrap(async (req, res) => {
      const car = await service.create(
        validateCar(createCarSchema, req.body),
        req.requestId,
      );
      etag(res, car);
      success(res, req.requestId, { car }, 201);
    }),
    replace: wrap(async (req, res) => {
      const car = await service.replace(
        validateCarId(req.params.carId),
        parseIfMatch(req.headers['if-match']),
        validateCar(updateCarSchema, req.body),
        req.requestId,
      );
      etag(res, car);
      success(res, req.requestId, { car });
    }),
    activate: wrap(async (req, res) => {
      validateCar(updateCarSchema.pick({}).strict(), req.body);
      const car = await service.changeStatus(
        validateCarId(req.params.carId),
        parseIfMatch(req.headers['if-match']),
        'active',
        req.requestId,
      );
      etag(res, car);
      success(res, req.requestId, { car });
    }),
    deactivate: wrap(async (req, res) => {
      validateCar(updateCarSchema.pick({}).strict(), req.body);
      const car = await service.changeStatus(
        validateCarId(req.params.carId),
        parseIfMatch(req.headers['if-match']),
        'inactive',
        req.requestId,
      );
      etag(res, car);
      success(res, req.requestId, { car });
    }),
    remove: wrap(async (req, res) => {
      const car = await service.remove(
        validateCarId(req.params.carId),
        parseIfMatch(req.headers['if-match']),
        req.requestId,
      );
      etag(res, car);
      success(res, req.requestId, { car });
    }),
  };
}
