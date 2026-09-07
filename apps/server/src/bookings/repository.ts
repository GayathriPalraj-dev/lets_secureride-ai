import type {
  AdminBookingListQuery,
  BookingListQuery,
  BookingStatus,
  Role,
} from '@lets-secureride-ai/contracts';
import type { createBookingModel } from '../models/booking.js';
import type { createBookingOccupancyModel } from '../models/booking-occupancy.js';
import { occupancyDates, type AvailabilityRepository } from './availability.js';
import type { Model } from 'mongoose';
export interface BookingRecord {
  id: string;
  userId: string;
  carId: string;
  carSnapshot: { inventoryCode: string; make: string; model: string };
  startDate: Date;
  endDateExclusive: Date;
  dailyRateMinor: number;
  currency: 'INR';
  billableDays: number;
  totalAmountMinor: number;
  status: BookingStatus;
  revision: number;
  statusChangedAt: Date;
  statusChangedByRole: Role;
  statusReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface BookingCreate {
  userId: string;
  carId: string;
  carSnapshot: BookingRecord['carSnapshot'];
  startDate: Date;
  endDateExclusive: Date;
  dailyRateMinor: number;
  billableDays: number;
  totalAmountMinor: number;
  at: Date;
}
export interface ParsedBookingList extends BookingListQuery {
  status: NonNullable<BookingListQuery['status']>;
  sort: NonNullable<BookingListQuery['sort']>;
  page: number;
  pageSize: number;
}
export interface ParsedAdminBookingList extends Omit<
  AdminBookingListQuery,
  'startFrom' | 'startBefore'
> {
  status: NonNullable<BookingListQuery['status']>;
  sort: NonNullable<BookingListQuery['sort']>;
  page: number;
  pageSize: number;
  startFrom?: Date;
  startBefore?: Date;
}
export type MutationResult =
  | { result: 'updated'; booking: BookingRecord }
  | { result: 'missing' | 'stale' | 'invalid' };
export class OccupancyConflict extends Error {
  constructor() {
    super('Booking occupancy conflict');
  }
}
export interface BookingRepository extends AvailabilityRepository {
  create(value: BookingCreate): Promise<BookingRecord>;
  listOwner(
    userId: string,
    q: ParsedBookingList,
  ): Promise<{ items: BookingRecord[]; totalItems: number }>;
  findOwner(id: string, userId: string): Promise<BookingRecord | null>;
  listAdmin(
    q: ParsedAdminBookingList,
  ): Promise<{ items: BookingRecord[]; totalItems: number }>;
  findAdmin(id: string): Promise<BookingRecord | null>;
  mutate(
    id: string,
    userId: string | undefined,
    revision: number,
    from: BookingStatus[],
    to: BookingStatus,
    role: Role,
    reason: string | null,
    at: Date,
    release: boolean,
  ): Promise<MutationResult>;
}
type Models = {
  bookings: ReturnType<typeof createBookingModel>;
  occupancies: ReturnType<typeof createBookingOccupancyModel>;
  payments?: Model<unknown>;
};
type Row = Record<string, unknown> & { _id: { toString(): string } };
const oid = (v: unknown) => String(v);
function map(r: Row): BookingRecord {
  const snap = r.carSnapshot as Record<string, unknown>;
  return {
    id: r._id.toString(),
    userId: oid(r.userId),
    carId: oid(r.carId),
    carSnapshot: {
      inventoryCode: String(snap.inventoryCode),
      make: String(snap.make),
      model: String(snap.model),
    },
    startDate: r.startDate as Date,
    endDateExclusive: r.endDateExclusive as Date,
    dailyRateMinor: Number(r.dailyRateMinor),
    currency: 'INR',
    billableDays: Number(r.billableDays),
    totalAmountMinor: Number(r.totalAmountMinor),
    status: r.status as BookingStatus,
    revision: Number(r.revision),
    statusChangedAt: r.statusChangedAt as Date,
    statusChangedByRole: r.statusChangedByRole as Role,
    statusReason: (r.statusReason as string | null) ?? null,
    createdAt: r.createdAt as Date,
    updatedAt: r.updatedAt as Date,
  };
}
function occupancyDuplicate(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  return (
    e.code === 11000 &&
    (e.index === 'booking_occupancy_car_date_unique' ||
      e.indexName === 'booking_occupancy_car_date_unique' ||
      (typeof e.message === 'string' &&
        e.message.includes('booking_occupancy_car_date_unique')))
  );
}
export function createBookingRepository(models: Models): BookingRepository {
  async function classify(
    id: string,
    userId: string | undefined,
    revision: number,
  ): Promise<MutationResult> {
    const q: Record<string, unknown> = { _id: id };
    if (userId) q.userId = userId;
    const row = (await models.bookings
      .findOne(q)
      .select('revision status')
      .lean()) as Row | null;
    if (!row) return { result: 'missing' };
    return Number(row.revision) !== revision
      ? { result: 'stale' }
      : { result: 'invalid' };
  }
  const filter = (q: ParsedBookingList) =>
    q.status === 'all' ? {} : { status: q.status };
  return {
    async create(v) {
      try {
        return await models.bookings.db.transaction(async (session) => {
          const created = await models.bookings.create(
            [
              {
                ...v,
                currency: 'INR',
                status: 'pending',
                revision: 0,
                statusChangedAt: v.at,
                statusChangedByRole: 'customer',
                statusReason: null,
              },
            ],
            { session },
          );
          const b = created[0]!.toObject() as Row;
          await models.occupancies.insertMany(
            occupancyDates(v.startDate, v.endDateExclusive).map((date) => ({
              bookingId: b._id,
              carId: v.carId,
              date,
            })),
            { session },
          );
          return map(b);
        });
      } catch (error) {
        if (occupancyDuplicate(error)) throw new OccupancyConflict();
        throw error;
      }
    },
    async listOwner(userId, q) {
      const f = { userId, ...filter(q) };
      const sort =
        q.sort === 'start_asc'
          ? { startDate: 1 as const, _id: 1 as const }
          : { createdAt: -1 as const, _id: -1 as const };
      const [rows, totalItems] = await Promise.all([
        models.bookings
          .find(f)
          .sort(sort)
          .skip((q.page - 1) * q.pageSize)
          .limit(q.pageSize)
          .lean(),
        models.bookings.countDocuments(f),
      ]);
      return { items: rows.map((r) => map(r as Row)), totalItems };
    },
    async findOwner(id, userId) {
      const r = (await models.bookings
        .findOne({ _id: id, userId })
        .lean()) as Row | null;
      return r ? map(r) : null;
    },
    async listAdmin(q) {
      const f: Record<string, unknown> = { ...filter(q) };
      if (q.carId) f.carId = q.carId;
      if (q.startFrom || q.startBefore)
        f.startDate = {
          ...(q.startFrom ? { $gte: q.startFrom } : {}),
          ...(q.startBefore ? { $lt: q.startBefore } : {}),
        };
      const sort =
        q.sort === 'start_asc'
          ? { startDate: 1 as const, _id: 1 as const }
          : { createdAt: -1 as const, _id: -1 as const };
      const [rows, totalItems] = await Promise.all([
        models.bookings
          .find(f)
          .sort(sort)
          .skip((q.page - 1) * q.pageSize)
          .limit(q.pageSize)
          .lean(),
        models.bookings.countDocuments(f),
      ]);
      return { items: rows.map((r) => map(r as Row)), totalItems };
    },
    async findAdmin(id) {
      const r = (await models.bookings.findById(id).lean()) as Row | null;
      return r ? map(r) : null;
    },
    async mutate(id, userId, revision, from, to, role, reason, at, release) {
      return models.bookings.db.transaction(async (session) => {
        const q: Record<string, unknown> = {
          _id: id,
          revision,
          status: { $in: from },
        };
        if (userId) q.userId = userId;
        const r = (await models.bookings
          .findOneAndUpdate(
            q,
            {
              $set: {
                status: to,
                statusChangedAt: at,
                statusChangedByRole: role,
                statusReason: reason,
              },
              $inc: { revision: 1 },
            },
            { new: true, runValidators: true, session },
          )
          .lean()) as Row | null;
        if (!r) return classify(id, userId, revision);
        if (release)
          await models.occupancies.deleteMany({ bookingId: id }, { session });
        if (to === 'cancelled' && models.payments)
          await models.payments.updateOne(
            { bookingId: id, status: 'succeeded', 'refund.status': 'none' },
            { $set: { 'refund.status': 'required', 'refund.updatedAt': at } },
            { session },
          );
        return { result: 'updated', booking: map(r) };
      });
    },
    async hasOccupancy(carId, dates) {
      return (
        (await models.occupancies.exists({ carId, date: { $in: dates } })) !==
        null
      );
    },
    async hasBlockingBooking(carId, after) {
      return (
        (await models.bookings.exists({
          carId,
          status: { $in: ['pending', 'confirmed'] },
          endDateExclusive: { $gt: after },
        })) !== null
      );
    },
  };
}
export const isNamedOccupancyDuplicate = occupancyDuplicate;
