import { createContext } from 'react';
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
  AuthCredentials,
  AuthUser,
  AdminBooking,
  AdminBookingListData,
  AdminBookingListQuery,
  BookingDatesRequest,
  BookingListData,
  BookingListQuery,
  BookingQuote,
  CustomerBooking,
  CustomerPayment,
  AdminPayment,
  PaymentConfirmation,
  PaymentListData,
  PaymentListQuery,
  AdminPaymentListData,
  AdminPaymentListQuery,
  AdminCarImage,
  AdminCarImageListData,
  CreateCarImageUploadRequest,
  UpdateCarImageRequest,
} from '@lets-secureride-ai/contracts';
export interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: AuthUser | null;
  error: string | null;
  login(credentials: AuthCredentials): Promise<void>;
  register(credentials: AuthCredentials): Promise<void>;
  logout(all?: boolean): Promise<void>;
  verifyAdminAccess?(): Promise<void>;
  listCars?(values?: CarListQuery): Promise<CarListData>;
  carDetail?(id: string): Promise<CarDetail>;
  adminCars?(values?: AdminCarListQuery): Promise<AdminCarListData>;
  adminCar?(id: string): Promise<AdminCar>;
  createCar?(body: CreateCarRequest): Promise<AdminCar>;
  updateCar?(
    id: string,
    revision: number,
    body: UpdateCarRequest,
  ): Promise<AdminCar>;
  setCarStatus?(
    id: string,
    revision: number,
    status: CarStatus,
  ): Promise<AdminCar>;
  deleteCar?(id: string, revision: number): Promise<AdminCar>;
  quoteBooking?(body: BookingDatesRequest): Promise<BookingQuote>;
  createBooking?(body: BookingDatesRequest): Promise<CustomerBooking>;
  listBookings?(query?: BookingListQuery): Promise<BookingListData>;
  bookingDetail?(id: string): Promise<CustomerBooking>;
  cancelBooking?(id: string, revision: number): Promise<CustomerBooking>;
  adminBookings?(query?: AdminBookingListQuery): Promise<AdminBookingListData>;
  adminBooking?(id: string): Promise<AdminBooking>;
  adminBookingAction?(
    id: string,
    revision: number,
    action: 'confirm' | 'reject' | 'cancel',
    reason?: string,
  ): Promise<AdminBooking>;
  startPayment?(
    bookingId: string,
    revision: number,
  ): Promise<{ payment: CustomerPayment; confirmation?: PaymentConfirmation }>;
  paymentByBooking?(bookingId: string): Promise<CustomerPayment>;
  paymentDetail?(id: string): Promise<CustomerPayment>;
  listPayments?(query?: PaymentListQuery): Promise<PaymentListData>;
  adminPayments?(query?: AdminPaymentListQuery): Promise<AdminPaymentListData>;
  adminPayment?(id: string): Promise<AdminPayment>;
  adminPaymentAction?(
    id: string,
    revision: number,
    action: 'reconcile' | 'refund',
    reason?: string,
  ): Promise<AdminPayment>;
  adminCarImages?(carId: string): Promise<AdminCarImageListData>;
  authorizeCarImage?(
    carId: string,
    body: CreateCarImageUploadRequest,
    revision: number,
  ): Promise<
    import('@lets-secureride-ai/contracts').CarImageUploadAuthorization
  >;
  completeCarImage?(
    carId: string,
    imageId: string,
    revision: number,
  ): Promise<AdminCarImage>;
  updateCarImage?(
    carId: string,
    imageId: string,
    revision: number,
    body: UpdateCarImageRequest,
  ): Promise<AdminCarImage>;
  primaryCarImage?(
    carId: string,
    imageId: string,
    revision: number,
  ): Promise<AdminCarImage>;
  removeCarImage?(
    carId: string,
    imageId: string,
    revision: number,
  ): Promise<AdminCarImage>;
  carImageContent?(url: string, signal?: AbortSignal): Promise<Blob>;
  retry(): void;
}
export const AuthContext = createContext<AuthState | null>(null);
