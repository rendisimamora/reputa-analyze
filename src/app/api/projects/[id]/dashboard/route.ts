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
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== user.id) return jsonError('Not found', 404);

    const includeAi = req.nextUrl.searchParams.get('ai') === '1';
    const snapshot = await getDashboardSnapshot(id, { includeAi });
    return jsonOk(snapshot);
  });
}
