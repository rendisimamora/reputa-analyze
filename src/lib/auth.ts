/**
 * iron-session based auth. Stores only userId in an encrypted cookie.
 * Routes use `getSession()` / `requireUser()` helpers.
 */
import { cookies } from 'next/headers';
import { getIronSession, type SessionOptions } from 'iron-session';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { env } from './env';

export interface SessionData {
  userId?: string;
}

export const sessionOptions: SessionOptions = {
  password: env.sessionPassword,
  cookieName: 'reputascan_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
    path: '/',
  },
};

export async function getSession() {
  // Next.js 15: cookies() returns a Promise<ReadonlyRequestCookies>
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) throw new Response('Unauthorized', { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw new Response('Unauthorized', { status: 401 });
  return user;
}

export async function tryGetUser() {
  try {
    const session = await getSession();
    if (!session.userId) return null;
    return prisma.user.findUnique({ where: { id: session.userId } });
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
