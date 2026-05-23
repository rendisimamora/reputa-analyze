/**
 * Dashboard sub-endpoint — recent section.
 *
 * Split out from the combined /dashboard endpoint so the page can fetch each
 * section in parallel and render progressively. The page's old /dashboard?ai=1
 * call has been replaced by 3 parallel calls to summary / charts / recent.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { getDashboardRecent } from '@/services/insights';

interface Ctx { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({
      where: { userId: user.id, slug, deletedAt: null },
      select: { id: true },
    });
    if (!project) return jsonError('Not found', 404);
    const data = await getDashboardRecent(project.id);
    return jsonOk(data);
  });
}
