import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { reanalyzeProject } from '@/services/reanalyze';

interface Ctx { params: Promise<{ slug: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({ where: { userId: user.id, slug, deletedAt: null } });
    if (!project) return jsonError('Not found', 404);

    const result = await reanalyzeProject(project.id);
    if (result.firstError && result.analyzed === 0) {
      return jsonError(
        `Semua mention gagal dianalisis. ${result.firstError}`,
        502,
        result as unknown as Record<string, unknown>,
      );
    }
    return jsonOk(result);
  });
}
