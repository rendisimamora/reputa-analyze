import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { getDashboardSnapshot } from '@/services/insights';

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!project || project.userId !== user.id) return jsonError('Not found', 404);

    // AI summary is always read from DB cache (kept in sync by scan/reanalyze).
    // The `ai` query flag is kept for backwards-compat but is now a no-op.
    const snapshot = await getDashboardSnapshot(id);
    return jsonOk(snapshot);
  });
}
