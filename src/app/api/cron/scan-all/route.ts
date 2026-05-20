/**
 * Cron entrypoint — can be hit by external scheduler (e.g. Vercel Cron, GitHub Actions)
 * or by our in-process node-cron runner. Requires `?token=<SESSION_PASSWORD>` for auth
 * (re-uses the session secret to avoid yet another env var).
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { runScan } from '@/services/scanRunner';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const token = req.nextUrl.searchParams.get('token') ?? req.headers.get('x-cron-token');
    if (!token || token !== env.sessionPassword) return jsonError('Forbidden', 403);

    const projects = await prisma.project.findMany({ where: { active: true, deletedAt: null } });
    const results: Array<{ projectId: string; ok: boolean; error?: string }> = [];
    for (const p of projects) {
      try {
        await runScan(p.id, 'CRON');
        results.push({ projectId: p.id, ok: true });
      } catch (err) {
        results.push({ projectId: p.id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return jsonOk({ processed: results.length, results });
  });
}
