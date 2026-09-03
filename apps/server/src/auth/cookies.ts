import { parseCookie, stringifySetCookie } from 'cookie';
import type { Request, Response } from 'express';
import { unauthorized } from './token-service.js';
export function createAuthCookies(production: boolean) {
  const name = production ? '__Host-lsrai-refresh' : 'lsrai-refresh';
  const options = {
    name,
    httpOnly: true,
    secure: production,
    sameSite: 'lax' as const,
    path: '/',
  };
  return {
    name,
    read(req: Request): string | undefined {
      const header = req.headers.cookie;
      if (!header) return undefined;
      if (
        header.length > 8192 ||
        header.split(';').filter((part) => part.trim().split('=')[0] === name)
          .length > 1
      )
        throw unauthorized();
      const value = parseCookie(header)[name];
      if (value !== undefined && value.length > 128) throw unauthorized();
      return value;
    },
    set(res: Response, token: string, expiresAt: Date, now: Date) {
      res.append(
        'Set-Cookie',
        stringifySetCookie({
          ...options,
          value: token,
          expires: expiresAt,
          maxAge: Math.max(
            0,
            Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
          ),
        }),
      );
    },
    clear(res: Response) {
      res.append(
        'Set-Cookie',
        stringifySetCookie({
          ...options,
          value: '',
          maxAge: 0,
          expires: new Date(0),
        }),
      );
    },
  };
}
export type AuthCookies = ReturnType<typeof createAuthCookies>;
