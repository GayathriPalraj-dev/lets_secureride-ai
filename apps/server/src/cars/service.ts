import type {
  AdminCarListData,
  CarListData,
  CarStatus,
  CreateCarRequest,
  UpdateCarRequest,
} from '@lets-secureride-ai/contracts';
import { AppError } from '../utils/app-error.js';
import type { CarEvents, CarEventName } from './events.js';
import {
  DuplicateCar,
  type CarMutation,
  type CarRepository,
  type ParsedAdminCarListQuery,
  type ParsedCarListQuery,
} from './repository.js';
import { toAdminCar, toCarDetail, toCarSummary } from './response.js';

const missing = () => new AppError(404, 'CAR_NOT_FOUND', 'Car was not found');
const conflict = () =>
  new AppError(409, 'CAR_CONFLICT', 'Car was changed; reload and try again');
export function createCarService(
  repository: CarRepository,
  events: CarEvents,
  now = () => new Date(),
) {
  async function safe<T>(
    operation: string,
    requestId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof DuplicateCar) {
        events({
          event: 'CAR_MUTATION_CONFLICT',
          outcome: 'failure',
          requestId,
          operation,
        });
        throw conflict();
      }
      events({
        event: 'CAR_OPERATION_FAILED',
        outcome: 'failure',
        requestId,
        operation,
      });
      throw new AppError(
        503,
        'CAR_UNAVAILABLE',
        'Car inventory is temporarily unavailable',
      );
    }
  }
  function changed(result: CarMutation) {
    if (result.result !== 'updated') {
      if (result.result === 'missing') throw missing();
      if (result.result === 'conflict') throw conflict();
      throw new AppError(
        409,
        'CAR_MUST_BE_INACTIVE',
        'Deactivate the car before deletion',
      );
    }
    return result.car;
  }
  function emit(event: CarEventName, requestId: string, operation: string) {
    events({ event, outcome: 'success', requestId, operation });
  }
  return {
    list(query: ParsedCarListQuery, requestId: string): Promise<CarListData> {
      return safe('list', requestId, async () => {
        const result = await repository.listPublic(query);
        return {
          items: result.items.map(toCarSummary),
          page: query.page,
          pageSize: query.pageSize,
          totalItems: result.totalItems,
          totalPages: Math.ceil(result.totalItems / query.pageSize),
        };
      });
    },
    detail(id: string, requestId: string) {
      return safe('detail', requestId, async () => {
        const car = await repository.findPublic(id);
        if (!car) throw missing();
        return toCarDetail(car);
      });
    },
    adminList(
      query: ParsedAdminCarListQuery,
      requestId: string,
    ): Promise<AdminCarListData> {
      return safe('admin-list', requestId, async () => {
        const result = await repository.listAdmin(query);
        return {
          items: result.items.map(toAdminCar),
          page: query.page,
          pageSize: query.pageSize,
          totalItems: result.totalItems,
          totalPages: Math.ceil(result.totalItems / query.pageSize),
        };
      });
    },
    adminDetail(id: string, requestId: string) {
      return safe('admin-detail', requestId, async () => {
        const car = await repository.findAdmin(id);
        if (!car) throw missing();
        return toAdminCar(car);
      });
    },
    create(value: CreateCarRequest, requestId: string) {
      return safe('create', requestId, async () => {
        const car = toAdminCar(await repository.create(value));
        emit('CAR_CREATED', requestId, 'create');
        return car;
      });
    },
    replace(
      id: string,
      revision: number,
      value: UpdateCarRequest,
      requestId: string,
    ) {
      return safe('update', requestId, async () => {
        const car = toAdminCar(
          changed(await repository.replace(id, revision, value)),
        );
        emit('CAR_UPDATED', requestId, 'update');
        return car;
      });
    },
    changeStatus(
      id: string,
      revision: number,
      status: CarStatus,
      requestId: string,
    ) {
      return safe(status, requestId, async () => {
        const car = toAdminCar(
          changed(await repository.changeStatus(id, revision, status)),
        );
        emit(
          status === 'active' ? 'CAR_ACTIVATED' : 'CAR_DEACTIVATED',
          requestId,
          status,
        );
        return car;
      });
    },
    remove(id: string, revision: number, requestId: string) {
      return safe('delete', requestId, async () => {
        const car = toAdminCar(
          changed(await repository.softDelete(id, revision, now())),
        );
        emit('CAR_DELETED', requestId, 'delete');
        return car;
      });
    },
  };
}
export type CarService = ReturnType<typeof createCarService>;
