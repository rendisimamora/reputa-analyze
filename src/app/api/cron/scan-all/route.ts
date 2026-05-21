/**
 * Cron entrypoint.
 *
 * In the new architecture, this endpoint ONLY enqueues scans (creates QUEUED
 * ScanRun rows). The standalone scheduler worker (PM2 on VM) picks them up
 * and executes the pipeline.
 *
 * This means the Next.js process is no longer doing any heavy crawl/analyze
 * work — even when hit by an external cron (Vercel Cron, GitHub Actions, etc).
 *
 * Auth: ?token=<SESSION_PASSWORD> (re-using the session secret).
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { enqueueScan } from '@/services/scanRunner';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const token = req.nextUrl.searchParams.get('token') ?? req.headers.get('x-cron-token');
    if (!token || token !== env.sessionPassword) return jsonError('Forbidden', 403);

    const projects = await prisma.project.findMany({ where: { active: true, deletedAt: null } });
    const results: Array<{ projectId: string; scanRunId?: string; ok: boolean; error?: string }> = [];
    for (const p of projects) {
      try {
        const scanRunId = await enqueueScan(p.id, 'CRON');
        results.push({ projectId: p.id, scanRunId, ok: true });
      } catch (err) {
        results.push({ projectId: p.id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return jsonOk({ enqueued: results.length, results });
  });
}
