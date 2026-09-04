import { createContext } from 'react';
import type { AuthCredentials, AuthUser } from '@lets-secureride-ai/contracts';
export interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: AuthUser | null;
  error: string | null;
  login(credentials: AuthCredentials): Promise<void>;
  register(credentials: AuthCredentials): Promise<void>;
  logout(all?: boolean): Promise<void>;
  verifyAdminAccess?(): Promise<void>;
  retry(): void;
}
export const AuthContext = createContext<AuthState | null>(null);
