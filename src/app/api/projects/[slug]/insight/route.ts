/**
 * Insight endpoint.
 *
 * GET  → return both cached insights (content + keyword) + generatedAt.
 * POST → regenerate. Body: { type: 'content' | 'keyword' | 'all' } (default 'all').
 *
 * Generation is on-demand only — the scheduler also fires this after every
 * successful scan, so most page loads will hit the cache.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { regenerateInsightContent, readCachedInsightContent } from '@/services/insightContent';
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

    return jsonOk({
      content: readCachedInsightContent(project),
      keyword: readCachedInsightKeyword(project),
    });
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({
      where: { userId: user.id, slug, deletedAt: null },
    });
    if (!project) return jsonError('Not found', 404);

    const body = (await req.json().catch(() => ({}))) as { type?: string };
    const type = (body.type ?? 'all') as 'content' | 'keyword' | 'all';

    if (type === 'content') {
      const content = await regenerateInsightContent(project.id);
      return jsonOk({ content });
    }
    if (type === 'keyword') {
      const keyword = await regenerateInsightKeyword(project.id);
      return jsonOk({ keyword });
    }
    // 'all' — run in parallel
    const [content, keyword] = await Promise.all([
      regenerateInsightContent(project.id),
      regenerateInsightKeyword(project.id),
    ]);
    return jsonOk({ content, keyword });
  });
}
