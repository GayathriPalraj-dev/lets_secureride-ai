import type { Role } from '@lets-secureride-ai/contracts';
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: { userId: string; sessionId: string; role: Role };
    }
  }
}
export {};
