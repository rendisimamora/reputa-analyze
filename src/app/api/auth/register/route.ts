/**
 * Register → creates user, returns JWT token (same shape as login).
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { signAccessToken, hashPassword } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) return jsonError('Invalid body', 400, { issues: parsed.error.flatten() });

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (existing) return jsonError('Email already in use', 409);

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name ?? null,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });

    const token = await signAccessToken(user.id);
    return jsonOk({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  });
}
