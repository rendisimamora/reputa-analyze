import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== user.id) return jsonError('Not found', 404);
    const take = Math.min(500, Number(req.nextUrl.searchParams.get('take') ?? 200));
    const logs = await prisma.crawlLog.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return jsonOk({ logs });
  });
}
