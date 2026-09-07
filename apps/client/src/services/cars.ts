import type {
  AdminCar,
  AdminCarListData,
  AdminCarListQuery,
  CarDetail,
  CarListData,
  CarListQuery,
  CarStatus,
  CreateCarRequest,
  UpdateCarRequest,
} from '@lets-secureride-ai/contracts';
import { AuthError } from './auth';
export class CarError extends AuthError {}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function query(values: object) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== '') result.set(key, String(value));
  return result.size ? `?${result}` : '';
}
function car(value: unknown, admin = false): CarDetail | AdminCar {
  if (!record(value)) throw new CarError(503, 'INVALID_RESPONSE');
  const allowed = [
    'id',
    'inventoryCode',
    'make',
    'model',
    'year',
    'category',
    'transmission',
    'fuelType',
    'seats',
    'dailyRate',
    'description',
    'features',
    ...(admin
      ? ['registrationNumber', 'status', 'revision', 'createdAt', 'updatedAt']
      : []),
  ];
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    typeof value.id !== 'string' ||
    typeof value.inventoryCode !== 'string' ||
    typeof value.make !== 'string' ||
    typeof value.model !== 'string' ||
    !Number.isInteger(value.year) ||
    !Number.isInteger(value.seats) ||
    !record(value.dailyRate) ||
    !Number.isInteger(value.dailyRate.amountMinor) ||
    value.dailyRate.currency !== 'INR' ||
    typeof value.description !== 'string' ||
    !Array.isArray(value.features) ||
    !value.features.every((item) => typeof item === 'string')
  )
    throw new CarError(503, 'INVALID_RESPONSE');
  if (
    admin &&
    (typeof value.registrationNumber !== 'string' ||
      (value.status !== 'active' && value.status !== 'inactive') ||
      !Number.isInteger(value.revision) ||
      typeof value.createdAt !== 'string' ||
      typeof value.updatedAt !== 'string')
  )
    throw new CarError(503, 'INVALID_RESPONSE');
  return value as unknown as CarDetail | AdminCar;
}
function list(value: unknown, admin = false): CarListData | AdminCarListData {
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    !['page', 'pageSize', 'totalItems', 'totalPages'].every((key) =>
      Number.isInteger(value[key]),
    )
  )
    throw new CarError(503, 'INVALID_RESPONSE');
  return {
    items: value.items.map((item) => car(item, admin)) as never,
    page: value.page as number,
    pageSize: value.pageSize as number,
    totalItems: value.totalItems as number,
    totalPages: value.totalPages as number,
  };
}
export function createCarRequests() {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(
    /\/$/,
    '',
  );
  async function request(
    path: string,
    method: string,
    token: string,
    body?: unknown,
    revision?: number,
  ) {
    let response: Response;
    try {
      response = await fetch(`${base}/${path}`, {
        method,
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(body !== undefined
            ? { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' }
            : {}),
          ...(revision !== undefined ? { 'If-Match': `"${revision}"` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new CarError(503, 'NETWORK_UNAVAILABLE');
    }
    let envelope: unknown;
    try {
      envelope = await response.json();
    } catch {
      throw new CarError(503, 'INVALID_RESPONSE');
    }
    if (!response.ok)
      throw new CarError(
        response.status,
        record(envelope) &&
          record(envelope.error) &&
          typeof envelope.error.code === 'string'
          ? envelope.error.code
          : 'CAR_REQUEST_FAILED',
      );
    if (
      !record(envelope) ||
      envelope.success !== true ||
      typeof envelope.requestId !== 'string' ||
      !record(envelope.data)
    )
      throw new CarError(503, 'INVALID_RESPONSE');
    return envelope.data;
  }
  return {
    list: async (token: string, values: CarListQuery = {}) =>
      list(await request(`cars${query(values)}`, 'GET', token)) as CarListData,
    detail: async (token: string, id: string) =>
      car(
        (await request(`cars/${encodeURIComponent(id)}`, 'GET', token)).car,
      ) as CarDetail,
    adminList: async (token: string, values: AdminCarListQuery = {}) =>
      list(
        await request(`admin/cars${query(values)}`, 'GET', token),
        true,
      ) as AdminCarListData,
    adminDetail: async (token: string, id: string) =>
      car(
        (await request(`admin/cars/${encodeURIComponent(id)}`, 'GET', token))
          .car,
        true,
      ) as AdminCar,
    create: async (token: string, body: CreateCarRequest) =>
      car(
        (await request('admin/cars', 'POST', token, body)).car,
        true,
      ) as AdminCar,
    replace: async (
      token: string,
      id: string,
      revision: number,
      body: UpdateCarRequest,
    ) =>
      car(
        (
          await request(
            `admin/cars/${encodeURIComponent(id)}`,
            'PUT',
            token,
            body,
            revision,
          )
        ).car,
        true,
      ) as AdminCar,
    status: async (
      token: string,
      id: string,
      revision: number,
      status: CarStatus,
    ) =>
      car(
        (
          await request(
            `admin/cars/${encodeURIComponent(id)}/${status === 'active' ? 'activate' : 'deactivate'}`,
            'POST',
            token,
            {},
            revision,
          )
        ).car,
        true,
      ) as AdminCar,
    remove: async (token: string, id: string, revision: number) =>
      car(
        (
          await request(
            `admin/cars/${encodeURIComponent(id)}`,
            'DELETE',
            token,
            {},
            revision,
          )
        ).car,
        true,
      ) as AdminCar,
  };
}
export type CarRequests = ReturnType<typeof createCarRequests>;
