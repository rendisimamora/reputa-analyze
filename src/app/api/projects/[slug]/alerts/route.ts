import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';

interface Ctx { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({ where: { userId: user.id, slug, deletedAt: null } });
    if (!project) return jsonError('Not found', 404);
    const alerts = await prisma.alert.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      // Explicit select — drops projectId (UI never reads it).
      select: {
        id: true,
        type: true,
        severity: true,
        title: true,
        message: true,
        acknowledged: true,
        createdAt: true,
        payload: true,
      },
    });
    return jsonOk({ alerts });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({ where: { userId: user.id, slug, deletedAt: null } });
    if (!project) return jsonError('Not found', 404);
    const body = (await req.json().catch(() => ({}))) as { alertId?: string; acknowledged?: boolean };
    if (!body.alertId) return jsonError('alertId required', 400);
    await prisma.alert.update({
      where: { id: body.alertId },
      data: { acknowledged: !!body.acknowledged },
    });
    return jsonOk({ ok: true });
  });
}
