import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import type { Prisma, CollectionMethod, CrawlStatus } from '@prisma/client';

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!project || project.userId !== user.id) return jsonError('Not found', 404);

    const p = req.nextUrl.searchParams;
    const where: Prisma.CrawlLogWhereInput = { projectId: id };

    const source = p.get('source');
    if (source) where.sourceKey = source;

    const method = p.get('method') as CollectionMethod | null;
    if (method) where.method = method;

    const status = p.get('status') as CrawlStatus | null;
    if (status) where.status = status;

    const from = p.get('from');
    const to = p.get('to');
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) {
        // inclusive end-of-day
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Prisma.DateTimeFilter).lte = end;
      }
    }

    const take = Math.min(100, Math.max(5, Number(p.get('take') ?? 25)));
    const skip = Math.max(0, Number(p.get('skip') ?? 0));

    const [items, total, distinctSources] = await Promise.all([
      prisma.crawlLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.crawlLog.count({ where }),
      // distinct source list for filter dropdown — scoped to this project's existing logs
      prisma.crawlLog.findMany({
        where: { projectId: id },
        distinct: ['sourceKey'],
        select: { sourceKey: true },
        orderBy: { sourceKey: 'asc' },
      }),
    ]);

    return jsonOk({
      items,
      total,
      take,
      skip,
      sources: distinctSources.map((s) => s.sourceKey),
    });
  });
}
