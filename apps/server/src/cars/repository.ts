import type {
  AdminCarListQuery,
  CarCategory,
  CarFuelType,
  CarListQuery,
  CarStatus,
  CarTransmission,
  CreateCarRequest,
  UpdateCarRequest,
} from '@lets-secureride-ai/contracts';
import type { createCarModel } from '../models/car.js';
import { deriveCarKeys } from './validation.js';

export interface CarRecord extends CreateCarRequest {
  id: string;
  registrationKey: string;
  makeKey: string;
  modelKey: string;
  currency: 'INR';
  status: CarStatus;
  revision: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface CarPage {
  items: CarRecord[];
  totalItems: number;
}
export type CarMutation =
  | { result: 'updated'; car: CarRecord }
  | { result: 'missing' | 'conflict' | 'active' };
export class DuplicateCar extends Error {
  constructor() {
    super('Car operation conflicted');
  }
}
export interface ParsedCarListQuery extends CarListQuery {
  sort: NonNullable<CarListQuery['sort']>;
  page: number;
  pageSize: number;
}
export interface ParsedAdminCarListQuery extends AdminCarListQuery {
  status: NonNullable<AdminCarListQuery['status']>;
  sort: NonNullable<AdminCarListQuery['sort']>;
  page: number;
  pageSize: number;
}
export interface CarRepository {
  create(value: CreateCarRequest): Promise<CarRecord>;
  listPublic(query: ParsedCarListQuery): Promise<CarPage>;
  findPublic(id: string): Promise<CarRecord | null>;
  listAdmin(query: ParsedAdminCarListQuery): Promise<CarPage>;
  findAdmin(id: string): Promise<CarRecord | null>;
  replace(
    id: string,
    revision: number,
    value: UpdateCarRequest,
  ): Promise<CarMutation>;
  changeStatus(
    id: string,
    revision: number,
    status: CarStatus,
  ): Promise<CarMutation>;
  softDelete(
    id: string,
    revision: number,
    deletedAt: Date,
  ): Promise<CarMutation>;
}

type CarModel = ReturnType<typeof createCarModel>;
type LeanCar = Record<string, unknown> & { _id: { toString(): string } };
function map(row: LeanCar): CarRecord {
  return {
    id: row._id.toString(),
    inventoryCode: String(row.inventoryCode),
    registrationNumber: String(row.registrationNumber),
    registrationKey: String(row.registrationKey),
    make: String(row.make),
    makeKey: String(row.makeKey),
    model: String(row.model),
    modelKey: String(row.modelKey),
    year: Number(row.year),
    category: row.category as CarCategory,
    transmission: row.transmission as CarTransmission,
    fuelType: row.fuelType as CarFuelType,
    seats: Number(row.seats),
    dailyRateMinor: Number(row.dailyRateMinor),
    currency: 'INR',
    description: String(row.description),
    features: [...(row.features as string[])],
    status: row.status as CarStatus,
    revision: Number(row.revision),
    deletedAt: (row.deletedAt as Date | null) ?? null,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}
function isDuplicate(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
export function createCarRepository(model: CarModel): CarRepository {
  async function classify(
    id: string,
    inactiveOnly = false,
  ): Promise<CarMutation> {
    const current = await model
      .findOne({ _id: id, deletedAt: null })
      .select('status')
      .lean();
    if (!current) return { result: 'missing' };
    if (inactiveOnly && current.status === 'active')
      return { result: 'active' };
    return { result: 'conflict' };
  }
  return {
    async create(value) {
      try {
        const keys = deriveCarKeys(value);
        return map(
          (
            await model.create({
              ...value,
              ...keys,
              currency: 'INR',
              status: 'inactive',
              revision: 0,
              deletedAt: null,
            })
          ).toObject() as LeanCar,
        );
      } catch (error) {
        if (isDuplicate(error)) throw new DuplicateCar();
        throw error;
      }
    },
    async listPublic(query) {
      const filter: Record<string, unknown> = {
        status: 'active',
        deletedAt: null,
      };
      if (query.make) filter.makeKey = query.make;
      if (query.category) filter.category = query.category;
      if (query.transmission) filter.transmission = query.transmission;
      if (query.fuelType) filter.fuelType = query.fuelType;
      if (query.minSeats) filter.seats = { $gte: query.minSeats };
      if (query.maxDailyRateMinor)
        filter.dailyRateMinor = { $lte: query.maxDailyRateMinor };
      const sort =
        query.sort === 'price_desc'
          ? { dailyRateMinor: -1 as const, _id: 1 as const }
          : query.sort === 'year_desc'
            ? { year: -1 as const, _id: 1 as const }
            : query.sort === 'make_asc'
              ? { makeKey: 1 as const, modelKey: 1 as const, _id: 1 as const }
              : { dailyRateMinor: 1 as const, _id: 1 as const };
      const [rows, totalItems] = await Promise.all([
        model
          .find(filter)
          .sort(sort)
          .skip((query.page - 1) * query.pageSize)
          .limit(query.pageSize)
          .lean(),
        model.countDocuments(filter),
      ]);
      return { items: rows.map((row) => map(row as LeanCar)), totalItems };
    },
    async findPublic(id) {
      const row = await model
        .findOne({ _id: id, status: 'active', deletedAt: null })
        .lean();
      return row ? map(row as LeanCar) : null;
    },
    async listAdmin(query) {
      const filter: Record<string, unknown> = { deletedAt: null };
      if (query.status !== 'all') filter.status = query.status;
      if (query.inventoryCode) filter.inventoryCode = query.inventoryCode;
      const sort =
        query.sort === 'make_asc'
          ? { makeKey: 1 as const, modelKey: 1 as const, _id: 1 as const }
          : { updatedAt: -1 as const, _id: 1 as const };
      const [rows, totalItems] = await Promise.all([
        model
          .find(filter)
          .sort(sort)
          .skip((query.page - 1) * query.pageSize)
          .limit(query.pageSize)
          .lean(),
        model.countDocuments(filter),
      ]);
      return { items: rows.map((row) => map(row as LeanCar)), totalItems };
    },
    async findAdmin(id) {
      const row = await model.findOne({ _id: id, deletedAt: null }).lean();
      return row ? map(row as LeanCar) : null;
    },
    async replace(id, revision, value) {
      const keys = deriveCarKeys({ ...value, registrationNumber: '' });
      const row = await model
        .findOneAndUpdate(
          { _id: id, revision, deletedAt: null },
          {
            $set: { ...value, makeKey: keys.makeKey, modelKey: keys.modelKey },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true },
        )
        .lean();
      return row
        ? { result: 'updated', car: map(row as LeanCar) }
        : classify(id);
    },
    async changeStatus(id, revision, status) {
      const row = await model
        .findOneAndUpdate(
          { _id: id, revision, deletedAt: null },
          { $set: { status }, $inc: { revision: 1 } },
          { new: true, runValidators: true },
        )
        .lean();
      return row
        ? { result: 'updated', car: map(row as LeanCar) }
        : classify(id);
    },
    async softDelete(id, revision, deletedAt) {
      const row = await model
        .findOneAndUpdate(
          { _id: id, revision, status: 'inactive', deletedAt: null },
          { $set: { deletedAt }, $inc: { revision: 1 } },
          { new: true },
        )
        .lean();
      return row
        ? { result: 'updated', car: map(row as LeanCar) }
        : classify(id, true);
    },
  };
}
