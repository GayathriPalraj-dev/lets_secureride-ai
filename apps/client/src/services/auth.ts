import type {
  AuthCredentials,
  AuthTokenData,
  AuthUser,
} from '@lets-secureride-ai/contracts';
export class AuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(
      status === 401
        ? 'Email or password is incorrect, or your session has ended.'
        : status === 409
          ? 'Unable to complete registration.'
          : status === 429
            ? 'Too many attempts. Please try again later.'
            : status === 400
              ? 'Check the supplied fields and try again.'
              : 'Authentication is temporarily unavailable. Please try again.',
    );
  }
}
export function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    /^[a-f0-9]{24}$/.test(v.id) &&
    typeof v.email === 'string' &&
    v.email.length <= 254 &&
    (v.role === 'customer' || v.role === 'admin')
  );
}
function user(value: unknown): AuthUser {
  if (!isAuthUser(value)) throw new AuthError(503, 'INVALID_RESPONSE');
  return { id: value.id, email: value.email, role: value.role };
}
export function createAuthRequests() {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(
    /\/$/,
    '',
  );
  async function request(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
    token?: string,
  ) {
    let response: Response;
    try {
      response = await fetch(base + '/' + path, {
        method,
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
        headers: {
          Accept: 'application/json',
          ...(method === 'POST'
            ? { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' }
            : {}),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
      });
    } catch {
      throw new AuthError(503, 'NETWORK_UNAVAILABLE');
    }
    let envelope: unknown;
    try {
      envelope = await response.json();
    } catch {
      throw new AuthError(503, 'INVALID_RESPONSE');
    }
    if (!response.ok)
      throw new AuthError(response.status, 'AUTH_REQUEST_FAILED');
    if (!envelope || typeof envelope !== 'object')
      throw new AuthError(503, 'INVALID_RESPONSE');
    const result = envelope as Record<string, unknown>;
    if (
      result.success !== true ||
      typeof result.requestId !== 'string' ||
      !result.requestId ||
      !result.data ||
      typeof result.data !== 'object'
    )
      throw new AuthError(503, 'INVALID_RESPONSE');
    return result.data as Record<string, unknown>;
  }
  async function tokenResponse(
    path: string,
    body?: AuthCredentials,
  ): Promise<AuthTokenData> {
    const data = await request('auth/' + path, 'POST', body);
    if (
      typeof data.accessToken !== 'string' ||
      data.accessToken.length > 4096 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
        data.accessToken,
      ) ||
      data.tokenType !== 'Bearer' ||
      !Number.isInteger(data.expiresIn) ||
      (data.expiresIn as number) < 60 ||
      (data.expiresIn as number) > 900
    )
      throw new AuthError(503, 'INVALID_RESPONSE');
    return {
      user: user(data.user),
      accessToken: data.accessToken,
      tokenType: 'Bearer',
      expiresIn: data.expiresIn as number,
    };
  }
  return {
    async register(body: AuthCredentials) {
      const data = await request('auth/register', 'POST', body);
      return user(data.user);
    },
    login: (body: AuthCredentials) => tokenResponse('login', body),
    refresh: () => tokenResponse('refresh'),
    async me(token: string) {
      const data = await request('auth/me', 'GET', undefined, token);
      return user(data.user);
    },
    async logout(token?: string, all = false) {
      const data = await request(
        all ? 'auth/logout-all' : 'auth/logout',
        'POST',
        {},
        token,
      );
      if (data.loggedOut !== true) throw new AuthError(503, 'INVALID_RESPONSE');
    },
    async adminAccess(token: string) {
      const data = await request('admin/access', 'GET', undefined, token);
      if (data.authorized !== true || Object.keys(data).length !== 1)
        throw new AuthError(503, 'INVALID_RESPONSE');
    },
  };
}
export type AuthRequests = ReturnType<typeof createAuthRequests>;
