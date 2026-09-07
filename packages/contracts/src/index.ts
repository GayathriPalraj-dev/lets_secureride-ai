export type Environment = 'development' | 'test' | 'production';
export type Role = 'customer' | 'admin';
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
export interface AuthCredentials {
  email: string;
  password: string;
}
export interface AuthTokenData {
  user: AuthUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}
export type AuthTokenResponse = ApiSuccess<AuthTokenData>;
export type AuthUserResponse = ApiSuccess<{ user: AuthUser }>;
export type AuthLogoutResponse = ApiSuccess<{ loggedOut: true }>;
export interface AdminAccessData {
  authorized: true;
}
export type AdminAccessResponse = ApiSuccess<AdminAccessData>;

export type CarCategory = 'hatchback' | 'sedan' | 'suv' | 'luxury' | 'van';
export type CarTransmission = 'manual' | 'automatic';
export type CarFuelType = 'petrol' | 'diesel' | 'electric' | 'hybrid';
export type CarStatus = 'active' | 'inactive';
export type CarSort = 'price_asc' | 'price_desc' | 'year_desc' | 'make_asc';
export type AdminCarSort = 'updated_desc' | 'make_asc';

export interface CarMoney {
  amountMinor: number;
  currency: 'INR';
}
export interface CarSummary {
  id: string;
  inventoryCode: string;
  make: string;
  model: string;
  year: number;
  category: CarCategory;
  transmission: CarTransmission;
  fuelType: CarFuelType;
  seats: number;
  dailyRate: CarMoney;
}
export interface CarDetail extends CarSummary {
  description: string;
  features: string[];
}
export interface AdminCar extends CarDetail {
  registrationNumber: string;
  status: CarStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface CarListQuery {
  make?: string;
  category?: CarCategory;
  transmission?: CarTransmission;
  fuelType?: CarFuelType;
  minSeats?: number;
  maxDailyRateMinor?: number;
  sort?: CarSort;
  page?: number;
  pageSize?: number;
}
export interface AdminCarListQuery {
  status?: CarStatus | 'all';
  inventoryCode?: string;
  sort?: AdminCarSort;
  page?: number;
  pageSize?: number;
}
export interface CreateCarRequest {
  inventoryCode: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  category: CarCategory;
  transmission: CarTransmission;
  fuelType: CarFuelType;
  seats: number;
  dailyRateMinor: number;
  description: string;
  features: string[];
}
export type UpdateCarRequest = Omit<
  CreateCarRequest,
  'inventoryCode' | 'registrationNumber'
>;
export interface CarListData {
  items: CarSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
export interface AdminCarListData {
  items: AdminCar[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
export type CarListResponse = ApiSuccess<CarListData>;
export type AdminCarListResponse = ApiSuccess<AdminCarListData>;
export type CarResponse = ApiSuccess<{ car: CarDetail }>;
export type AdminCarResponse = ApiSuccess<{ car: AdminCar }>;
export type CarMutationResponse = AdminCarResponse;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string };
  requestId: string;
}

export interface HealthData {
  service: 'lets-secureride-ai-api';
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
  environment: Environment;
}

export type HealthResponse = ApiSuccess<HealthData>;

export interface ReadinessData {
  service: 'lets-secureride-ai-api';
  status: 'ready';
  database: 'connected';
  timestamp: string;
}

export interface ReadinessError extends ApiError {
  error: {
    code: 'SERVICE_NOT_READY';
    message: 'Service is temporarily unavailable';
  };
}
export type ReadinessResponse = ApiSuccess<ReadinessData> | ReadinessError;
