/**
 * Insight Content endpoint (counter-content briefs).
 *
 * Split out from the combined /insight endpoint so the page only fetches
 * what the active view needs — keyword view doesn't waste a round-trip
 * pulling content payload, and vice versa.
 *
 * GET  → return cached content briefs.
 * POST → regenerate content briefs (LLM call).
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { regenerateInsightContent, readCachedInsightContent } from '@/services/insightContent';

interface Ctx { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({
      where: { userId: user.id, slug, deletedAt: null },
    });
    if (!project) return jsonError('Not found', 404);
    return jsonOk({ content: readCachedInsightContent(project) });
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
    const content = await regenerateInsightContent(project.id);
    return jsonOk({ content });
  });
}
