/**
 * Login → returns JWT access token.
 *
 * Response shape:
 *   { user: { id, email, name }, token: "eyJhb..." }
 *
 * Client stores the token (localStorage / secure storage) and sends it
 * with subsequent requests as: `Authorization: Bearer <token>`.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { signAccessToken, verifyPassword } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonError('Invalid body', 400);

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user) return jsonError('Invalid credentials', 401);

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) return jsonError('Invalid credentials', 401);

    const token = await signAccessToken(user.id);
    return jsonOk({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  });
}
