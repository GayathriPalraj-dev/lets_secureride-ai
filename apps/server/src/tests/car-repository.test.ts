import { describe, expect, it, vi } from 'vitest';
import type { createCarModel } from '../models/car.js';
import { createCarRepository, DuplicateCar } from '../cars/repository.js';

const row = (change: Record<string, unknown> = {}) => ({
  _id: { toString: () => 'a'.repeat(24) },
  inventoryCode: 'CAR_1',
  registrationNumber: 'KA 01 AA 1000',
  registrationKey: 'KA01AA1000',
  make: 'Tata',
  makeKey: 'tata',
  model: 'Nexon',
  modelKey: 'nexon',
  year: 2025,
  category: 'suv',
  transmission: 'automatic',
  fuelType: 'electric',
  seats: 5,
  dailyRateMinor: 250000,
  currency: 'INR',
  description: 'Electric SUV',
  features: ['GPS'],
  status: 'active',
  revision: 0,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...change,
});
const input = () => ({
  inventoryCode: 'CAR_1',
  registrationNumber: 'KA 01 AA 1000',
  make: 'Tata',
  model: 'Nexon',
  year: 2025,
  category: 'suv' as const,
  transmission: 'automatic' as const,
  fuelType: 'electric' as const,
  seats: 5,
  dailyRateMinor: 250000,
  description: 'Electric SUV',
  features: ['GPS'],
});
function fixture() {
  let rows = [row()];
  const chain = {
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    select: vi.fn(),
    lean: vi.fn(),
  };
  chain.sort.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.lean.mockImplementation(async () => rows);
  const one = { select: vi.fn(), lean: vi.fn() };
  one.select.mockReturnValue(one);
  one.lean.mockImplementation(async () => rows[0] ?? null);
  const updated = { lean: vi.fn() };
  updated.lean.mockImplementation(async () => rows[0] ?? null);
  const model = {
    create: vi.fn(async (value) => ({ toObject: () => row(value) })),
    find: vi.fn(() => chain),
    countDocuments: vi.fn(async () => rows.length),
    findOne: vi.fn(() => one),
    findOneAndUpdate: vi.fn(() => updated),
  };
  return {
    model,
    chain,
    one,
    updated,
    setRows: (value: ReturnType<typeof row>[]) => {
      rows = value;
    },
    repository: createCarRepository(
      model as unknown as ReturnType<typeof createCarModel>,
    ),
  };
}
const publicQuery = { sort: 'price_asc' as const, page: 1, pageSize: 20 };
const adminQuery = {
  status: 'all' as const,
  sort: 'updated_desc' as const,
  page: 1,
  pageSize: 20,
};
describe('car repository', () => {
  it('creates and maps normalized inventory', async () => {
    const f = fixture();
    const car = await f.repository.create(input());
    expect(car.id).toHaveLength(24);
    expect(f.model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationKey: 'KA01AA1000',
        makeKey: 'tata',
        modelKey: 'nexon',
        status: 'inactive',
      }),
    );
  });
  it('converts duplicate creation errors', async () => {
    const f = fixture();
    f.model.create.mockRejectedValue({ code: 11000 });
    await expect(f.repository.create(input())).rejects.toBeInstanceOf(
      DuplicateCar,
    );
  });
  it('lists only active nondeleted customer cars', async () => {
    const f = fixture();
    await f.repository.listPublic(publicQuery);
    expect(f.model.find).toHaveBeenCalledWith({
      status: 'active',
      deletedAt: null,
    });
  });
  it('applies approved exact customer filters', async () => {
    const f = fixture();
    await f.repository.listPublic({
      ...publicQuery,
      make: 'tata',
      category: 'suv',
      transmission: 'automatic',
      fuelType: 'electric',
      minSeats: 4,
      maxDailyRateMinor: 300000,
    });
    expect(f.model.find).toHaveBeenCalledWith(
      expect.objectContaining({
        makeKey: 'tata',
        category: 'suv',
        seats: { $gte: 4 },
        dailyRateMinor: { $lte: 300000 },
      }),
    );
  });
  it('uses stable allowlisted sorting', async () => {
    const f = fixture();
    await f.repository.listPublic({ ...publicQuery, sort: 'make_asc' });
    expect(f.chain.sort).toHaveBeenCalledWith({
      makeKey: 1,
      modelKey: 1,
      _id: 1,
    });
  });
  it('applies bounded pagination offsets', async () => {
    const f = fixture();
    await f.repository.listPublic({ ...publicQuery, page: 3, pageSize: 10 });
    expect(f.chain.skip).toHaveBeenCalledWith(20);
    expect(f.chain.limit).toHaveBeenCalledWith(10);
  });
  it('lists inactive inventory only for admin queries', async () => {
    const f = fixture();
    await f.repository.listAdmin({ ...adminQuery, status: 'inactive' });
    expect(f.model.find).toHaveBeenCalledWith({
      deletedAt: null,
      status: 'inactive',
    });
  });
  it('uses separate public and admin detail visibility', async () => {
    const f = fixture();
    await f.repository.findPublic('a'.repeat(24));
    expect(f.model.findOne).toHaveBeenCalledWith({
      _id: 'a'.repeat(24),
      status: 'active',
      deletedAt: null,
    });
    await f.repository.findAdmin('a'.repeat(24));
    expect(f.model.findOne).toHaveBeenLastCalledWith({
      _id: 'a'.repeat(24),
      deletedAt: null,
    });
  });
  it('atomically replaces a matching revision', async () => {
    const f = fixture();
    await f.repository.replace('a'.repeat(24), 2, input());
    expect(f.model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'a'.repeat(24),
        revision: 2,
        deletedAt: null,
      }),
      expect.objectContaining({ $inc: { revision: 1 } }),
      expect.objectContaining({ new: true }),
    );
  });
  it('atomically changes status and revision', async () => {
    const f = fixture();
    await f.repository.changeStatus('a'.repeat(24), 0, 'inactive');
    expect(f.model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'a'.repeat(24), revision: 0, deletedAt: null },
      { $set: { status: 'inactive' }, $inc: { revision: 1 } },
      expect.anything(),
    );
  });
  it('soft deletes only inactive matching revisions', async () => {
    const f = fixture(),
      at = new Date();
    await f.repository.softDelete('a'.repeat(24), 3, at);
    expect(f.model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'a'.repeat(24), revision: 3, status: 'inactive', deletedAt: null },
      { $set: { deletedAt: at }, $inc: { revision: 1 } },
      { new: true },
    );
  });
  it('classifies missing active and concurrent outcomes', async () => {
    const f = fixture();
    f.setRows([]);
    f.updated.lean.mockResolvedValue(null);
    await expect(
      f.repository.replace('a'.repeat(24), 0, input()),
    ).resolves.toEqual({ result: 'missing' });
    f.setRows([row({ status: 'active' })]);
    await expect(
      f.repository.softDelete('a'.repeat(24), 0, new Date()),
    ).resolves.toEqual({ result: 'active' });
    f.setRows([row({ status: 'inactive' })]);
    await expect(
      f.repository.changeStatus('a'.repeat(24), 4, 'active'),
    ).resolves.toEqual({ result: 'conflict' });
  });
});
