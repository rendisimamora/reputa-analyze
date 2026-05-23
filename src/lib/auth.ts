/**
 * JWT-based auth. Tokens are signed HS256 with JWT_SECRET, sent by clients
 * via `Authorization: Bearer <token>`.
 *
 * Public surface:
 *   - signAccessToken(userId)   → issue a fresh token (login / refresh)
 *   - verifyAccessToken(token)  → returns userId or null
 *   - requireUser()             → reads Authorization header, throws 401 if invalid
 *   - tryGetUser()              → same but returns null instead of throwing
 *   - hashPassword / verifyPassword → bcrypt helpers (unchanged)
 *
 * Notes:
 *   - Tokens are STATELESS — no DB lookup needed for verify. Tradeoff: can't
 *     revoke individual tokens. If revocation needed later, add `tokenVersion`
 *     to User and include it in the claim; bump version to revoke all tokens.
 *   - `headers()` from next/headers gives us the incoming request headers in
 *     Server Components / Route Handlers without passing req around.
 */
import { headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { env } from './env';

const ALGO = 'HS256';

function secretKey(): Uint8Array {
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or too short (min 32 chars). Generate one with: openssl rand -base64 48',
    );
  }
  return new TextEncoder().encode(env.jwtSecret);
}

export interface AccessTokenClaims {
  sub: string;
  iat: number;
  exp: number;
}

/** Issue a fresh JWT for a user. Used by login + token refresh. */
export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGO })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${env.jwtTtlSeconds}s`)
    .sign(secretKey());
}

/** Verify a JWT and return its userId, or null if invalid/expired. */
export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALGO] });
    if (typeof payload.sub !== 'string') return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/**
 * Extract bearer token from the current request's Authorization header.
 * Returns the raw token string or null.
 */
async function readBearerToken(): Promise<string | null> {
  const h = await headers();
  const authHeader = h.get('authorization') ?? h.get('Authorization');
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1] ?? null;
}

/** Throws 401 Response if the request is missing or has an invalid token. */
export async function requireUser() {
  const token = await readBearerToken();
  if (!token) throw new Response('Unauthorized', { status: 401 });
  const userId = await verifyAccessToken(token);
  if (!userId) throw new Response('Unauthorized', { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Response('Unauthorized', { status: 401 });
  return user;
}

/** Same as requireUser() but returns null instead of throwing. */
export async function tryGetUser() {
  try {
    const token = await readBearerToken();
    if (!token) return null;
    const userId = await verifyAccessToken(token);
    if (!userId) return null;
    return prisma.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
