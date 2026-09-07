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
  retry(): void;
}
export const AuthContext = createContext<AuthState | null>(null);
