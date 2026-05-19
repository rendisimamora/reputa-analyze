import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { regenerateAiSummary } from '@/services/aiSummary';

interface Ctx { params: Promise<{ id: string }> }

/** POST = force-regenerate the cached AI executive summary for this project. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== user.id) return jsonError('Not found', 404);
    const result = await regenerateAiSummary(id);
    if (result.error) {
      return jsonError(`Regenerate gagal: ${result.error}`, 502, { result });
    }
    return jsonOk(result);
  });
}
