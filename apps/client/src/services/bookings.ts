import type {
  AdminBooking,
  AdminBookingListData,
  AdminBookingListQuery,
  BookingDatesRequest,
  BookingListData,
  BookingListQuery,
  BookingQuote,
  CustomerBooking,
} from '@lets-secureride-ai/contracts';
import { AuthError } from './auth';
export class BookingError extends AuthError {}
const rec = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function booking(v: unknown, admin = false) {
  if (!rec(v)) throw new BookingError(503, 'INVALID_RESPONSE');
  const keys = [
    'id',
    'car',
    'startDate',
    'endDateExclusive',
    'billableDays',
    'dailyRate',
    'total',
    'status',
    'revision',
    'createdAt',
    'updatedAt',
    ...(admin
      ? [
          'customerReference',
          'statusChangedAt',
          'statusChangedByRole',
          'statusReason',
        ]
      : []),
  ];
  if (
    Object.keys(v).some((k) => !keys.includes(k)) ||
    typeof v.id !== 'string' ||
    !rec(v.car) ||
    typeof v.car.id !== 'string' ||
    !Number.isSafeInteger(v.revision) ||
    !Number.isSafeInteger(v.billableDays) ||
    !rec(v.total) ||
    !Number.isSafeInteger(v.total.amountMinor)
  )
    throw new BookingError(503, 'INVALID_RESPONSE');
  return v as unknown as CustomerBooking | AdminBooking;
}
const qs = (v: object) => {
  const q = new URLSearchParams();
  Object.entries(v).forEach(([k, x]) => {
    if (x !== undefined && x !== '') q.set(k, String(x));
  });
  return q.size ? '?' + q : '';
};
export function createBookingRequests() {
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
    let r: Response;
    try {
      r = await fetch(base + '/' + path, {
        method,
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + token,
          ...(body !== undefined
            ? { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' }
            : {}),
          ...(revision !== undefined ? { 'If-Match': `"${revision}"` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new BookingError(503, 'NETWORK_UNAVAILABLE');
    }
    let e: unknown;
    try {
      e = await r.json();
    } catch {
      throw new BookingError(503, 'INVALID_RESPONSE');
    }
    if (!r.ok)
      throw new BookingError(
        r.status,
        rec(e) && rec(e.error) && typeof e.error.code === 'string'
          ? e.error.code
          : 'BOOKING_REQUEST_FAILED',
      );
    if (
      !rec(e) ||
      e.success !== true ||
      typeof e.requestId !== 'string' ||
      !rec(e.data)
    )
      throw new BookingError(503, 'INVALID_RESPONSE');
    return e.data;
  }
  const list = (d: Record<string, unknown>, admin = false) => {
    if (
      !Array.isArray(d.items) ||
      !['page', 'pageSize', 'totalItems', 'totalPages'].every((k) =>
        Number.isInteger(d[k]),
      )
    )
      throw new BookingError(503, 'INVALID_RESPONSE');
    return { ...d, items: d.items.map((x) => booking(x, admin)) } as unknown as
      BookingListData | AdminBookingListData;
  };
  return {
    quote: async (t: string, b: BookingDatesRequest) =>
      (await request('bookings/quote', 'POST', t, b)).quote as BookingQuote,
    create: async (t: string, b: BookingDatesRequest) =>
      booking((await request('bookings', 'POST', t, b)).booking),
    list: async (t: string, q: BookingListQuery = {}) =>
      list(await request('bookings' + qs(q), 'GET', t)) as BookingListData,
    detail: async (t: string, id: string) =>
      booking(
        (await request('bookings/' + encodeURIComponent(id), 'GET', t)).booking,
      ),
    cancel: async (t: string, id: string, r: number) =>
      booking(
        (
          await request(
            `bookings/${encodeURIComponent(id)}/cancel`,
            'POST',
            t,
            {},
            r,
          )
        ).booking,
      ),
    adminList: async (t: string, q: AdminBookingListQuery = {}) =>
      list(
        await request('admin/bookings' + qs(q), 'GET', t),
        true,
      ) as AdminBookingListData,
    adminDetail: async (t: string, id: string) =>
      booking(
        (await request('admin/bookings/' + encodeURIComponent(id), 'GET', t))
          .booking,
        true,
      ) as AdminBooking,
    adminAction: async (
      t: string,
      id: string,
      r: number,
      a: 'confirm' | 'reject' | 'cancel',
      reason?: string,
    ) =>
      booking(
        (
          await request(
            `admin/bookings/${encodeURIComponent(id)}/${a}`,
            'POST',
            t,
            reason ? { reason } : {},
            r,
          )
        ).booking,
        true,
      ) as AdminBooking,
  };
}
export type BookingRequests = ReturnType<typeof createBookingRequests>;
