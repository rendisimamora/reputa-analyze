import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { startScan } from '@/services/scanRunner';
import { get as getProgress, getLatestForProject } from '@/services/scanProgress';

interface Ctx { params: Promise<{ slug: string }> }

// POST → kick off a background scan, return scanRunId immediately
export async function POST(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({ where: { userId: user.id, slug, deletedAt: null } });
    if (!project) return jsonError('Not found', 404);

    const scanRunId = await startScan(project.id, 'MANUAL');
    return jsonOk({ scanRunId, status: 'RUNNING' });
  });
}

// GET → progress for a specific scanRunId (or latest for project)
export async function GET(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({ where: { userId: user.id, slug, deletedAt: null } });
    if (!project) return jsonError('Not found', 404);

    const scanRunId = req.nextUrl.searchParams.get('scanRunId');
    const p = scanRunId ? getProgress(scanRunId) : getLatestForProject(project.id);

    if (!p) {
      const last = await prisma.scanRun.findFirst({
        where: { projectId: project.id },
        orderBy: { startedAt: 'desc' },
      });
      if (!last) return jsonOk({ progress: null });
      return jsonOk({
        progress: {
          scanRunId: last.id,
          projectId: project.id,
          stage: last.status === 'RUNNING' ? 'QUEUED' : last.status === 'SUCCESS' || last.status === 'PARTIAL' ? 'DONE' : 'FAILED',
          percent: last.status === 'RUNNING' ? 0 : 100,
          label: last.status === 'RUNNING' ? 'Memulai…' : 'Selesai',
          totalSources: 16,
          sourcesDone: 0,
          fetched: last.fetched,
          toAnalyze: last.analyzed,
          analyzed: last.analyzed,
        },
      });
    }
    return jsonOk({ progress: p });
  });
}
