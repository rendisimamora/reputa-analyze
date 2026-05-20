import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { reanalyzeProject } from '@/services/reanalyze';

interface Ctx { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!project || project.userId !== user.id) return jsonError('Not found', 404);

    const result = await reanalyzeProject(id);
    if (result.firstError && result.analyzed === 0) {
      return jsonError(`Semua mention gagal dianalisis. ${result.firstError}`, 502, result);
    }
    return jsonOk(result);
  });
}
