import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { getDashboardSnapshot } from '@/services/insights';

interface Ctx { params: Promise<{ id: string }> }

const DAY = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== user.id) return jsonError('Not found', 404);

    const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string };
    const to = body.to ? new Date(body.to) : new Date();
    const from = body.from ? new Date(body.from) : new Date(to.getTime() - 14 * DAY);

    const snap = await getDashboardSnapshot(id, { includeAi: true });
    const payload = { ...snap, range: { from, to } };

    const report = await prisma.report.create({
      data: {
        projectId: id,
        title: `Reputation Report — ${snap.project.name}`,
        rangeFrom: from,
        rangeTo: to,
        payload: payload as object,
      },
    });

    return jsonOk({ report });
  });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== user.id) return jsonError('Not found', 404);
    const reports = await prisma.report.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, title: true, rangeFrom: true, rangeTo: true, createdAt: true },
    });
    return jsonOk({ reports });
  });
}
