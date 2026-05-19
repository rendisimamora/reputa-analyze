import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';

interface Ctx { params: Promise<{ id: string }> }

async function ownedProject(userId: string, id: string) {
  const p = await prisma.project.findUnique({ where: { id }, include: { keywords: true } });
  if (!p || p.userId !== userId) return null;
  return p;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await ownedProject(user.id, id);
    if (!project) return jsonError('Not found', 404);
    return jsonOk({ project });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await ownedProject(user.id, id);
    if (!project) return jsonError('Not found', 404);
    await prisma.project.delete({ where: { id } });
    return jsonOk({ ok: true });
  });
}
