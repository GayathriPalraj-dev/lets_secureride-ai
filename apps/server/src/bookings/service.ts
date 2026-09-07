import type { Role } from '@lets-secureride-ai/contracts';
import { AppError } from '../utils/app-error.js';
import type { CarRepository } from '../cars/repository.js';
import { bookingPrice } from './pricing.js';
import { nextBookingStatus, type BookingAction } from './lifecycle.js';
import {
  OccupancyConflict,
  type BookingRepository,
  type ParsedAdminBookingList,
  type ParsedBookingList,
  type MutationResult,
} from './repository.js';
import { toAdminBooking, toCustomerBooking } from './response.js';
import type { BookingEvents } from './events.js';
const missing = () =>
  new AppError(404, 'BOOKING_NOT_FOUND', 'Booking was not found');
const unavailable = () =>
  new AppError(
    503,
    'BOOKING_UNAVAILABLE',
    'Booking service is temporarily unavailable',
  );
export function createBookingService(
  repo: BookingRepository,
  cars: CarRepository,
  events: BookingEvents,
  now = () => new Date(),
  afterCancellation: (bookingId: string) => Promise<void> = async () => {},
) {
  async function safe<T>(
    op: string,
    requestId: string,
    work: () => Promise<T>,
  ) {
    try {
      return await work();
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (e instanceof OccupancyConflict) {
        events({
          event: 'BOOKING_CONFLICT',
          outcome: 'failure',
          requestId,
          operation: op,
        });
        throw new AppError(
          409,
          'BOOKING_CONFLICT',
          'The car is unavailable for those dates',
        );
      }
      events({
        event: 'BOOKING_OPERATION_FAILED',
        outcome: 'failure',
        requestId,
        operation: op,
      });
      throw unavailable();
    }
  }
  async function quote(input: {
    carId: string;
    startDate: Date;
    endDateExclusive: Date;
  }) {
    const car = await cars.findAdmin(input.carId);
    if (!car || car.status !== 'active' || car.deletedAt)
      throw new AppError(
        409,
        'CAR_NOT_BOOKABLE',
        'Car is not available for booking',
      );
    const price = bookingPrice(
      car.dailyRateMinor,
      input.startDate,
      input.endDateExclusive,
    );
    return {
      car,
      price,
      available: !(await repo.hasOccupancy(
        input.carId,
        (await import('./availability.js')).occupancyDates(
          input.startDate,
          input.endDateExclusive,
        ),
      )),
    };
  }
  function changed(r: MutationResult) {
    if (r.result === 'updated') return r.booking;
    if (r.result === 'missing') throw missing();
    if (r.result === 'stale')
      throw new AppError(
        409,
        'BOOKING_STALE',
        'Booking changed; reload and try again',
      );
    throw new AppError(
      409,
      'BOOKING_INVALID_TRANSITION',
      'Booking action is not allowed',
    );
  }
  return {
    quote: (i: Parameters<typeof quote>[0], rid: string) =>
      safe('quote', rid, async () => {
        const q = await quote(i);
        return {
          car: {
            id: q.car.id,
            inventoryCode: q.car.inventoryCode,
            make: q.car.make,
            model: q.car.model,
          },
          startDate: i.startDate.toISOString().slice(0, 10),
          endDateExclusive: i.endDateExclusive.toISOString().slice(0, 10),
          billableDays: q.price.billableDays,
          dailyRate: {
            amountMinor: q.car.dailyRateMinor,
            currency: 'INR' as const,
          },
          total: {
            amountMinor: q.price.totalAmountMinor,
            currency: 'INR' as const,
          },
          available: q.available,
        };
      }),
    async create(userId: string, i: Parameters<typeof quote>[0], rid: string) {
      return safe('create', rid, async () => {
        const q = await quote(i);
        if (!q.available)
          throw new AppError(
            409,
            'BOOKING_CONFLICT',
            'The car is unavailable for those dates',
          );
        const b = await repo.create({
          userId,
          carId: q.car.id,
          carSnapshot: {
            inventoryCode: q.car.inventoryCode,
            make: q.car.make,
            model: q.car.model,
          },
          startDate: i.startDate,
          endDateExclusive: i.endDateExclusive,
          dailyRateMinor: q.car.dailyRateMinor,
          ...q.price,
          at: now(),
        });
        events({
          event: 'BOOKING_CREATED',
          outcome: 'success',
          requestId: rid,
          operation: 'create',
          actorRole: 'customer',
        });
        return toCustomerBooking(b);
      });
    },
    async listOwner(userId: string, q: ParsedBookingList, rid: string) {
      return safe('list', rid, async () => {
        const r = await repo.listOwner(userId, q);
        return {
          items: r.items.map(toCustomerBooking),
          page: q.page,
          pageSize: q.pageSize,
          totalItems: r.totalItems,
          totalPages: Math.ceil(r.totalItems / q.pageSize),
        };
      });
    },
    async ownerDetail(id: string, userId: string, rid: string) {
      return safe('detail', rid, async () => {
        const b = await repo.findOwner(id, userId);
        if (!b) throw missing();
        return toCustomerBooking(b);
      });
    },
    async adminList(q: ParsedAdminBookingList, rid: string) {
      return safe('admin-list', rid, async () => {
        const r = await repo.listAdmin(q);
        return {
          items: r.items.map(toAdminBooking),
          page: q.page,
          pageSize: q.pageSize,
          totalItems: r.totalItems,
          totalPages: Math.ceil(r.totalItems / q.pageSize),
        };
      });
    },
    async adminDetail(id: string, rid: string) {
      return safe('admin-detail', rid, async () => {
        const b = await repo.findAdmin(id);
        if (!b) throw missing();
        return toAdminBooking(b);
      });
    },
    async mutate(
      id: string,
      userId: string | undefined,
      revision: number,
      action: BookingAction,
      role: Role,
      reason: string | null,
      rid: string,
    ) {
      return safe(action, rid, async () => {
        const current = userId
          ? await repo.findOwner(id, userId)
          : await repo.findAdmin(id);
        if (!current) throw missing();
        if (current.revision !== revision)
          throw new AppError(
            409,
            'BOOKING_STALE',
            'Booking changed; reload and try again',
          );
        const next = nextBookingStatus(
          current.status,
          action,
          role,
          now(),
          current.startDate,
          current.endDateExclusive,
        );
        if (!next)
          throw new AppError(
            409,
            'BOOKING_INVALID_TRANSITION',
            'Booking action is not allowed',
          );
        const b = changed(
          await repo.mutate(
            id,
            userId,
            revision,
            [current.status],
            next,
            role,
            reason,
            now(),
            next === 'cancelled' || next === 'rejected',
          ),
        );
        if (next === 'cancelled') await afterCancellation(b.id);
        events({
          event:
            next === 'confirmed'
              ? 'BOOKING_CONFIRMED'
              : next === 'rejected'
                ? 'BOOKING_REJECTED'
                : 'BOOKING_CANCELLED',
          outcome: 'success',
          requestId: rid,
          operation: action,
          actorRole: role,
          fromStatus: current.status,
          toStatus: next,
        });
        return role === 'admin' ? toAdminBooking(b) : toCustomerBooking(b);
      });
    },
    hasBlockingBooking: (carId: string) =>
      repo.hasBlockingBooking(carId, now()),
  };
}
export type BookingService = ReturnType<typeof createBookingService>;
