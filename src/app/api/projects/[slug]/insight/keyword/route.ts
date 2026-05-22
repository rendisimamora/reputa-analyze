/**
 * Insight Keyword endpoint (keyword suggestions).
 *
 * GET  → return cached keyword suggestions.
 * POST → regenerate keyword suggestions (LLM call).
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { regenerateInsightKeyword, readCachedInsightKeyword } from '@/services/insightKeyword';

interface Ctx { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({
      where: { userId: user.id, slug, deletedAt: null },
    });
    if (!project) return jsonError('Not found', 404);
    return jsonOk({ keyword: readCachedInsightKeyword(project) });
  });
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({
      where: { userId: user.id, slug, deletedAt: null },
    });
    if (!project) return jsonError('Not found', 404);
    const keyword = await regenerateInsightKeyword(project.id);
    return jsonOk({ keyword });
  });
}
