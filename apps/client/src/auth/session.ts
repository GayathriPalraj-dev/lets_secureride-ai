import type {
  AuthCredentials,
  AuthUser,
  AuthTokenData,
} from '@lets-secureride-ai/contracts';
import type {
  AdminPaymentListQuery,
  PaymentListQuery,
} from '@lets-secureride-ai/contracts';
import {
  createPaymentRequests,
  type PaymentRequests,
} from '../services/payments';
import {
  createBookingRequests,
  type BookingRequests,
} from '../services/bookings';
import type {
  AdminBookingListQuery,
  BookingDatesRequest,
  BookingListQuery,
} from '@lets-secureride-ai/contracts';
import {
  AuthError,
  createAuthRequests,
  type AuthRequests,
} from '../services/auth';
import { createCarRequests, type CarRequests } from '../services/cars';
import {
  createCarImageRequests,
  type CarImageRequests,
} from '../services/car-images';
import type {
  AdminCarListQuery,
  CarListQuery,
  CarStatus,
  CreateCarRequest,
  UpdateCarRequest,
} from '@lets-secureride-ai/contracts';
export function createAuthSession(
  requests: Omit<AuthRequests, 'adminAccess'> &
    Partial<Pick<AuthRequests, 'adminAccess'>> = createAuthRequests(),
  carRequests: CarRequests = createCarRequests(),
  bookingRequests: BookingRequests = createBookingRequests(),
  paymentRequests: PaymentRequests = createPaymentRequests(),
  imageRequests: CarImageRequests = createCarImageRequests(),
) {
  let access: string | undefined;
  let expires = 0;
  let generation = 0;
  let refreshPending: Promise<AuthUser> | undefined;
  let restorePending: Promise<AuthUser | null> | undefined;
  const listeners = new Set<() => void>();
  let channel: BroadcastChannel | undefined;
  const clear = () => {
    generation++;
    access = undefined;
    expires = 0;
  };
  function locked<T>(operation: () => Promise<T>): Promise<T> {
    return typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('lsrai-auth', operation)
      : operation();
  }
  function accept(data: AuthTokenData, expected: number) {
    if (expected !== generation) throw new AuthError(401, 'SESSION_CHANGED');
    access = data.accessToken;
    expires = Date.now() + data.expiresIn * 1000 - 5000;
    return data.user;
  }
  function refresh(): Promise<AuthUser> {
    if (!refreshPending) {
      const expected = generation;
      refreshPending = locked(async () => {
        if (expected !== generation)
          throw new AuthError(401, 'SESSION_CHANGED');
        return accept(await requests.refresh(), expected);
      }).finally(() => {
        refreshPending = undefined;
      });
    }
    return refreshPending;
  }
  async function me(): Promise<AuthUser> {
    const expected = generation;
    if (!access || Date.now() >= expires) await refresh();
    try {
      const user = await requests.me(access!);
      if (expected !== generation) throw new AuthError(401, 'SESSION_CHANGED');
      return user;
    } catch (error) {
      if (expected !== generation) throw new AuthError(401, 'SESSION_CHANGED');
      if (!(error instanceof AuthError) || error.status !== 401) throw error;
      await refresh();
      const user = await requests.me(access!);
      if (expected !== generation) throw new AuthError(401, 'SESSION_CHANGED');
      return user;
    }
  }
  async function withAccess<T>(
    operation: (token: string) => Promise<T>,
  ): Promise<T> {
    const expected = generation;
    if (!access || Date.now() >= expires) await refresh();
    try {
      return await operation(access!);
    } catch (error) {
      if (expected !== generation) throw new AuthError(401, 'SESSION_CHANGED');
      if (!(error instanceof AuthError) || error.status !== 401) throw error;
      try {
        await refresh();
        return await operation(access!);
      } catch (retryError) {
        if (retryError instanceof AuthError && retryError.status === 401)
          clear();
        throw retryError;
      }
    }
  }
  return {
    register: (credentials: AuthCredentials) => requests.register(credentials),
    async login(credentials: AuthCredentials) {
      const expected = ++generation;
      return locked(async () => {
        if (expected !== generation)
          throw new AuthError(401, 'SESSION_CHANGED');
        return accept(await requests.login(credentials), expected);
      });
    },
    restore(): Promise<AuthUser | null> {
      restorePending ??= (async () => {
        try {
          await refresh();
          return await me();
        } catch (error) {
          if (error instanceof AuthError && error.status === 401) {
            clear();
            return null;
          }
          throw error;
        }
      })().finally(() => {
        restorePending = undefined;
      });
      return restorePending;
    },
    me,
    verifyAdminAccess: () => {
      if (!requests.adminAccess)
        return Promise.reject(new AuthError(503, 'ADMIN_ACCESS_UNAVAILABLE'));
      return withAccess(requests.adminAccess);
    },
    listCars: (values: CarListQuery = {}) =>
      withAccess(async (token) => {
        const page = await carRequests.list(token, values);
        return {
          ...page,
          items: await Promise.all(
            page.items.map(async (car) => ({
              ...car,
              images: await imageRequests.customerList(token, car.id),
            })),
          ),
        };
      }),
    carDetail: (id: string) =>
      withAccess(async (token) => ({
        ...(await carRequests.detail(token, id)),
        images: await imageRequests.customerList(token, id),
      })),
    adminCars: (values: AdminCarListQuery = {}) =>
      withAccess((token) => carRequests.adminList(token, values)),
    adminCar: (id: string) =>
      withAccess((token) => carRequests.adminDetail(token, id)),
    createCar: (body: CreateCarRequest) =>
      withAccess((token) => carRequests.create(token, body)),
    updateCar: (id: string, revision: number, body: UpdateCarRequest) =>
      withAccess((token) => carRequests.replace(token, id, revision, body)),
    setCarStatus: (id: string, revision: number, status: CarStatus) =>
      withAccess((token) => carRequests.status(token, id, revision, status)),
    deleteCar: (id: string, revision: number) =>
      withAccess((token) => carRequests.remove(token, id, revision)),
    quoteBooking: (body: BookingDatesRequest) =>
      withAccess((token) => bookingRequests.quote(token, body)),
    createBooking: (body: BookingDatesRequest) =>
      withAccess((token) => bookingRequests.create(token, body)),
    listBookings: (q: BookingListQuery = {}) =>
      withAccess((token) => bookingRequests.list(token, q)),
    bookingDetail: (id: string) =>
      withAccess((token) => bookingRequests.detail(token, id)),
    cancelBooking: (id: string, revision: number) =>
      withAccess((token) => bookingRequests.cancel(token, id, revision)),
    adminBookings: (q: AdminBookingListQuery = {}) =>
      withAccess((token) => bookingRequests.adminList(token, q)),
    adminBooking: (id: string) =>
      withAccess((token) => bookingRequests.adminDetail(token, id)),
    adminBookingAction: (
      id: string,
      revision: number,
      action: 'confirm' | 'reject' | 'cancel',
      reason?: string,
    ) =>
      withAccess((token) =>
        bookingRequests.adminAction(token, id, revision, action, reason),
      ),
    startPayment: (bookingId: string, revision: number) =>
      withAccess((token) => paymentRequests.start(token, bookingId, revision)),
    paymentByBooking: (bookingId: string) =>
      withAccess((token) => paymentRequests.byBooking(token, bookingId)),
    paymentDetail: (id: string) =>
      withAccess((token) => paymentRequests.detail(token, id)),
    listPayments: (query: PaymentListQuery = {}) =>
      withAccess((token) => paymentRequests.list(token, query)),
    adminPayments: (query: AdminPaymentListQuery = {}) =>
      withAccess((token) => paymentRequests.adminList(token, query)),
    adminPayment: (id: string) =>
      withAccess((token) => paymentRequests.adminDetail(token, id)),
    adminPaymentAction: (
      id: string,
      revision: number,
      action: 'reconcile' | 'refund',
      reason?: string,
    ) =>
      withAccess((token) =>
        paymentRequests.adminAction(token, id, revision, action, reason),
      ),
    adminCarImages: (carId: string) =>
      withAccess((token) => imageRequests.adminList(token, carId)),
    authorizeCarImage: (
      carId: string,
      body: import('@lets-secureride-ai/contracts').CreateCarImageUploadRequest,
      revision: number,
    ) =>
      withAccess((token) =>
        imageRequests.authorize(token, carId, body, revision),
      ),
    completeCarImage: (carId: string, imageId: string, revision: number) =>
      withAccess((token) =>
        imageRequests
          .complete(token, carId, imageId, revision)
          .then((x) => x.image),
      ),
    updateCarImage: (
      carId: string,
      imageId: string,
      revision: number,
      body: import('@lets-secureride-ai/contracts').UpdateCarImageRequest,
    ) =>
      withAccess((token) =>
        imageRequests
          .update(token, carId, imageId, revision, body)
          .then(
            (x: {
              image: import('@lets-secureride-ai/contracts').AdminCarImage;
            }) => x.image,
          ),
      ),
    primaryCarImage: (carId: string, imageId: string, revision: number) =>
      withAccess((token) =>
        imageRequests
          .primary(token, carId, imageId, revision)
          .then(
            (x: {
              image: import('@lets-secureride-ai/contracts').AdminCarImage;
            }) => x.image,
          ),
      ),
    removeCarImage: (carId: string, imageId: string, revision: number) =>
      withAccess((token) =>
        imageRequests
          .remove(token, carId, imageId, revision)
          .then(
            (x: {
              image: import('@lets-secureride-ai/contracts').AdminCarImage;
            }) => x.image,
          ),
      ),
    carImageContent: (url: string, signal?: AbortSignal) =>
      withAccess((token) => imageRequests.content(token, url, signal)),
    async logout(all = false) {
      let token: string | undefined;
      try {
        if (all && (!access || Date.now() >= expires)) await refresh();
        token = access;
      } finally {
        clear();
        channel?.postMessage('logout');
      }
      try {
        await locked(() => requests.logout(token, all));
      } finally {
        for (const listener of listeners) listener();
      }
    },
    subscribeLogout(listener: () => void) {
      listeners.add(listener);
      if (!channel && typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('lsrai-auth');
        channel.onmessage = (event: MessageEvent<unknown>) => {
          if (event.data === 'logout') {
            clear();
            for (const callback of listeners) callback();
          }
        };
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          channel?.close();
          channel = undefined;
        }
      };
    },
    clear,
  };
}
export type AuthSession = ReturnType<typeof createAuthSession>;
