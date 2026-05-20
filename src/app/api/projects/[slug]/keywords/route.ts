import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';

interface Ctx { params: Promise<{ slug: string }> }

const Body = z.object({
  keywords: z.array(z.string().min(1).max(120)).min(1).max(10),
  matchMode: z.enum(['ANY', 'ALL']).default('ANY'),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({ where: { userId: user.id, slug, deletedAt: null } });
    if (!project) return jsonError('Not found', 404);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonError('Invalid body', 400, { issues: parsed.error.flatten() });

    await prisma.$transaction([
      prisma.keyword.deleteMany({ where: { projectId: project.id } }),
      prisma.keyword.createMany({
        data: [...new Set(parsed.data.keywords.map((k) => k.trim()))].map((term) => ({
          projectId: project.id,
          term,
          matchMode: parsed.data.matchMode,
        })),
      }),
    ]);

    const updated = await prisma.project.findUnique({
      where: { id: project.id },
      include: { keywords: true },
    });
    return jsonOk({ project: updated });
  });
}
