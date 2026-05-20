/**
 * Standalone scheduler process.
 *
 * Run: pnpm scheduler
 * Or via Docker: node --enable-source-maps dist/scheduler/runner.js
 *
 * Uses node-cron and the same business logic as the API.
 * For multi-instance deployments, only run ONE scheduler at a time
 * (or migrate to BullMQ — drop-in: replace runScan() call with queue.add).
 */
import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { env, assertServerEnv } from '@/lib/env';
import { runScan } from '@/services/scanRunner';

async function scanAllActive() {
  const projects = await prisma.project.findMany({ where: { active: true, deletedAt: null } });
  console.log(`[scheduler] tick — ${projects.length} active project(s)`);
  for (const p of projects) {
    try {
      const r = await runScan(p.id, 'CRON');
      console.log(
        `[scheduler] ${p.name}: +${r.newMentions} new, ${r.analyzed} analyzed, score=${r.score}`,
      );
    } catch (err) {
      console.error(`[scheduler] ${p.name} failed:`, err instanceof Error ? err.message : err);
    }
  }
}

function start() {
  assertServerEnv();
  if (!cron.validate(env.scanCron)) {
    throw new Error(`Invalid SCAN_CRON expression: ${env.scanCron}`);
  }
  console.log(`[scheduler] starting with cron "${env.scanCron}" (TZ=${process.env.TZ ?? 'local'})`);
  cron.schedule(env.scanCron, () => {
    void scanAllActive();
  });
  // also run once on boot
  void scanAllActive();
}

start();
