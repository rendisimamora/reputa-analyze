/**
 * Scan endpoint.
 *
 * POST → enqueue a scan (creates a QUEUED ScanRun row, returns scanRunId immediately).
 *        The actual work is executed by the standalone scheduler process (PM2 on VM),
 *        NOT inside Next.js. This keeps the web app light.
 *
 * GET  → read progress for a specific scanRunId (or the latest run for the project)
 *        directly from DB. No in-memory state.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { enqueueScan } from '@/services/scanRunner';
import { get as getProgress, getLatestForProject } from '@/services/scanProgress';

interface Ctx { params: Promise<{ slug: string }> }

// POST → enqueue a scan, return scanRunId immediately
export async function POST(_req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({ where: { userId: user.id, slug, deletedAt: null } });
    if (!project) return jsonError('Not found', 404);

    const scanRunId = await enqueueScan(project.id, 'MANUAL');
    return jsonOk({ scanRunId, status: 'QUEUED' });
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
    const p = scanRunId ? await getProgress(scanRunId) : await getLatestForProject(project.id);

    return jsonOk({ progress: p ?? null });
  });
}
