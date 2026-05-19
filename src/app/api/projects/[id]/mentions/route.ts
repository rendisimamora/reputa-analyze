import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import type { Prisma, Sentiment, CollectionMethod, CrawlStatus } from '@prisma/client';

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== user.id) return jsonError('Not found', 404);

    const p = req.nextUrl.searchParams;
    const where: Prisma.MentionWhereInput = { projectId: id };
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

    const take = Math.min(200, Math.max(1, Number(p.get('take') ?? 100)));
    const skip = Math.max(0, Number(p.get('skip') ?? 0));

    const [items, total] = await Promise.all([
      prisma.mention.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
      }),
      prisma.mention.count({ where }),
    ]);
    return jsonOk({ items, total });
  });
}
