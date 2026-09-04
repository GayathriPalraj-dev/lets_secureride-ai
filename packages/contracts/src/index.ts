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
