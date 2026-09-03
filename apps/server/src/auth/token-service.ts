import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { AuthConfig } from '../config/auth.js';
import { AppError } from '../utils/app-error.js';
export interface AccessIdentity {
  userId: string;
  sessionId: string;
  version: number;
}
export interface TokenService {
  sign(identity: AccessIdentity): Promise<string>;
  verify(token: string): Promise<AccessIdentity>;
  refresh(sessionId?: string): { id: string; token: string; hash: string };
  parseRefresh(token: string): { id: string; hash: string } | null;
}
export const unauthorized = () =>
  new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
export function equalDigest(a: string, b: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
export function createTokenService(
  config: AuthConfig,
  now: () => Date = () => new Date(),
): TokenService {
  const keys = new Map<string, Uint8Array>([
    [config.JWT_ACCESS_KEY_ID, Buffer.from(config.JWT_ACCESS_SECRET, 'base64')],
  ]);
  if (config.JWT_ACCESS_PREVIOUS_KEY_ID && config.JWT_ACCESS_PREVIOUS_SECRET) {
    keys.set(
      config.JWT_ACCESS_PREVIOUS_KEY_ID,
      Buffer.from(config.JWT_ACCESS_PREVIOUS_SECRET, 'base64'),
    );
  }
  const digest = (token: string) =>
    createHash('sha256').update(token).digest('hex');
  return {
    async sign(identity) {
      const issued = Math.floor(now().getTime() / 1000);
      return new SignJWT({ sid: identity.sessionId, ver: identity.version })
        .setProtectedHeader({
          alg: 'HS256',
          typ: 'at+jwt',
          kid: config.JWT_ACCESS_KEY_ID,
        })
        .setIssuer(config.JWT_ISSUER)
        .setAudience(config.JWT_AUDIENCE)
        .setSubject(identity.userId)
        .setIssuedAt(issued)
        .setExpirationTime(issued + config.AUTH_ACCESS_TTL_SECONDS)
        .setJti(randomBytes(16).toString('hex'))
        .sign(keys.get(config.JWT_ACCESS_KEY_ID)!);
    },
    async verify(token) {
      try {
        if (token.length > 4096) throw unauthorized();
        const { payload, protectedHeader } = await jwtVerify(
          token,
          (header) => {
            if (
              typeof header.kid !== 'string' ||
              !keys.has(header.kid) ||
              header.jku ||
              header.jwk ||
              header.x5u
            )
              throw unauthorized();
            return keys.get(header.kid)!;
          },
          {
            algorithms: ['HS256'],
            issuer: config.JWT_ISSUER,
            audience: config.JWT_AUDIENCE,
            typ: 'at+jwt',
            requiredClaims: [
              'iss',
              'aud',
              'sub',
              'sid',
              'iat',
              'exp',
              'jti',
              'ver',
            ],
            currentDate: now(),
            clockTolerance: 30,
          },
        );
        const timestamp = Math.floor(now().getTime() / 1000);
        if (
          protectedHeader.alg !== 'HS256' ||
          typeof payload.sub !== 'string' ||
          !/^[a-f0-9]{24}$/.test(payload.sub) ||
          typeof payload.sid !== 'string' ||
          !/^[a-f0-9]{32}$/.test(payload.sid) ||
          !Number.isSafeInteger(payload.ver) ||
          (payload.ver as number) < 0 ||
          typeof payload.jti !== 'string' ||
          !/^[a-f0-9]{32}$/.test(payload.jti) ||
          !Number.isSafeInteger(payload.iat) ||
          !Number.isSafeInteger(payload.exp) ||
          payload.iat! > timestamp + 30 ||
          payload.exp! <= payload.iat! ||
          payload.exp! - payload.iat! > config.AUTH_ACCESS_TTL_SECONDS
        )
          throw unauthorized();
        return {
          userId: payload.sub,
          sessionId: payload.sid,
          version: payload.ver as number,
        };
      } catch {
        throw unauthorized();
      }
    },
    refresh(sessionId) {
      const id = sessionId ?? randomBytes(16).toString('hex');
      const token = id + '.' + randomBytes(32).toString('base64url');
      return { id, token, hash: digest(token) };
    },
    parseRefresh(token) {
      if (!/^[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
      const [id, secret] = token.split('.');
      if (
        !id ||
        !secret ||
        Buffer.from(secret, 'base64url').toString('base64url') !== secret
      )
        return null;
      return { id, hash: digest(token) };
    },
  };
}
