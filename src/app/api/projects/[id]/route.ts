import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';

interface Ctx { params: Promise<{ id: string }> }

const UpdateBody = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  active: z.boolean().optional(),
});

async function ownedProject(userId: string, id: string) {
  const p = await prisma.project.findFirst({
    where: { id, userId, deletedAt: null },
    include: { keywords: true },
  });
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

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await ownedProject(user.id, id);
    if (!project) return jsonError('Not found', 404);

    const parsed = UpdateBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonError('Invalid body', 400, { issues: parsed.error.flatten() });

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      },
      include: { keywords: true },
    });
    return jsonOk({ project: updated });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await ownedProject(user.id, id);
    if (!project) return jsonError('Not found', 404);
    // Soft delete: keep all child data (mentions, alerts, reports, scans) intact,
    // just mark project as deleted + deactivate scheduler.
    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    return jsonOk({ ok: true });
  });
}
