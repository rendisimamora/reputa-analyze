import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import type { Prisma, Sentiment, CollectionMethod, CrawlStatus } from '@prisma/client';

interface Ctx { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({ where: { userId: user.id, slug, deletedAt: null } });
    if (!project) return jsonError('Not found', 404);

    const p = req.nextUrl.searchParams;
    const where: Prisma.MentionWhereInput = { projectId: project.id };
    const sentiment = p.get('sentiment') as Sentiment | null;
    if (sentiment) where.sentiment = sentiment;
    const source = p.get('source');
    if (source) where.sourceKey = source;
    const method = p.get('method') as CollectionMethod | null;
    if (method) where.collectionMethod = method;
    const status = p.get('status') as CrawlStatus | null;
    if (status) where.crawlStatus = status;
    const q = p.get('q');
    if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { snippet: { contains: q, mode: 'insensitive' } }];
    const from = p.get('from');
    const to = p.get('to');
    if (from || to) {
      where.publishedAt = {};
      if (from) (where.publishedAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.publishedAt as Prisma.DateTimeFilter).lte = new Date(to);
    }

    const take = Math.min(200, Math.max(5, Number(p.get('take') ?? 25)));
    const skip = Math.max(0, Number(p.get('skip') ?? 0));

    const [items, total, distinctSources] = await Promise.all([
      prisma.mention.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
        // Trim payload: exclude rawContent (full article body — bisa puluhan KB
        // per row), urlHash/contentHash (internal dedupe), author, matchedKeywords,
        // toxicity/hateSpeech/fakeNews/topic/aiSummary (gak ditampilkan di tabel).
        // Total: ~10x lebih kecil per row.
        select: {
          id: true,
          title: true,
          snippet: true,
          url: true,
          sourceName: true,
          sourceKey: true,
          publishedAt: true,
          sentiment: true,
          sentimentScore: true,
          emotion: true,
          collectionMethod: true,
          crawlStatus: true,
        },
      }),
      prisma.mention.count({ where }),
      prisma.mention.findMany({
        where: { projectId: project.id },
        distinct: ['sourceKey'],
        select: { sourceKey: true, sourceName: true },
        orderBy: { sourceKey: 'asc' },
      }),
    ]);
    return jsonOk({
      items,
      total,
      take,
      skip,
      sources: distinctSources.map((s) => ({ key: s.sourceKey, name: s.sourceName })),
    });
  });
}
