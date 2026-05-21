/**
 * Standalone scheduler process — the ONLY place scans actually execute.
 *
 * Run locally:        npm run scheduler
 * Run on VM via PM2:  pm2 start ecosystem.config.js
 *
 * Two responsibilities:
 *
 *   1. POLL loop  — every QUEUE_POLL_MS, atomically claim one QUEUED ScanRun
 *      and execute it. This is how UI-triggered "Scan" buttons get processed.
 *
 *   2. CRON tick  — on the configured SCAN_CRON expression, enqueue scans
 *      for all active projects. The poll loop then picks them up.
 *
 * Single-instance only. For HA, switch the claim mechanism to a row-level lock
 * or migrate to BullMQ.
 */
import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { env, assertServerEnv } from '@/lib/env';
import { enqueueScan, claimAndExecuteOne } from '@/services/scanRunner';

const QUEUE_POLL_MS = Number(process.env.QUEUE_POLL_MS ?? 2000);
const STUCK_RESCUE_MS = Number(process.env.STUCK_RESCUE_MS ?? 15 * 60 * 1000); // 15min

let pollInFlight = false;
let shuttingDown = false;

let pollTickCount = 0;

async function pollOnce() {
  if (pollInFlight || shuttingDown) return;
  pollInFlight = true;
  pollTickCount++;
  try {
    const queuedCount = await prisma.scanRun.count({ where: { status: 'QUEUED', claimedAt: null } });
    if (queuedCount > 0 || pollTickCount % 15 === 0) {
      console.log(`[worker] tick #${pollTickCount} — ${queuedCount} queued`);
    }
    const r = await claimAndExecuteOne();
    if (r) {
      console.log(
        `[worker] processed ${r.scanRunId} — +${r.newMentions} new, ${r.analyzed} analyzed, score=${r.score}`,
      );
    }
  } catch (err) {
    console.error('[worker] poll error:', err instanceof Error ? err.message : err, err);
  } finally {
    pollInFlight = false;
  }
}

async function rescueStuckScans() {
  // If a worker died mid-scan, the row stays RUNNING with claimedAt set but no
  // finishedAt. After STUCK_RESCUE_MS we mark it FAILED so the UI moves on.
  const cutoff = new Date(Date.now() - STUCK_RESCUE_MS);
  const result = await prisma.scanRun.updateMany({
    where: { status: 'RUNNING', finishedAt: null, claimedAt: { lt: cutoff } },
    data: { status: 'FAILED', finishedAt: new Date(), message: 'Worker died mid-scan (rescued)' },
  });
  if (result.count > 0) {
    console.warn(`[worker] rescued ${result.count} stuck scan(s)`);
  }
}

async function cronTick() {
  const projects = await prisma.project.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true, name: true },
  });
  console.log(`[cron] tick — enqueueing ${projects.length} active project(s)`);
  for (const p of projects) {
    try {
      const id = await enqueueScan(p.id, 'CRON');
      console.log(`[cron] enqueued ${p.name} → ${id}`);
    } catch (err) {
      console.error(`[cron] enqueue ${p.name} failed:`, err instanceof Error ? err.message : err);
    }
  }
}

async function bootDiagnostics() {
  try {
    const [total, queued, running] = await Promise.all([
      prisma.scanRun.count(),
      prisma.scanRun.count({ where: { status: 'QUEUED', claimedAt: null } }),
      prisma.scanRun.count({ where: { status: 'RUNNING', finishedAt: null } }),
    ]);
    console.log(`[scheduler] DB ok — ScanRun total=${total}, queued=${queued}, running=${running}`);
    const dbHost = (process.env.DATABASE_URL ?? '').replace(/:[^:@/]+@/, ':***@');
    console.log(`[scheduler] DATABASE_URL: ${dbHost || '(not set)'}`);
  } catch (err) {
    console.error('[scheduler] DB smoke-test FAILED:', err instanceof Error ? err.message : err);
    console.error('[scheduler] Likely causes: stale prisma client (run `npx prisma generate`), wrong DATABASE_URL, or DB unreachable.');
  }
}

function start() {
  assertServerEnv();
  if (!cron.validate(env.scanCron)) {
    throw new Error(`Invalid SCAN_CRON expression: ${env.scanCron}`);
  }

  console.log(`[scheduler] starting`);
  console.log(`            cron: "${env.scanCron}" (TZ=${process.env.TZ ?? 'local'})`);
  console.log(`            poll: every ${QUEUE_POLL_MS}ms`);
  console.log(`            stuck rescue: ${STUCK_RESCUE_MS}ms`);
  void bootDiagnostics();

  // cron schedule — enqueues only, never executes inline
  cron.schedule(env.scanCron, () => {
    void cronTick();
  });

  // poll loop — does the actual work
  setInterval(() => { void pollOnce(); }, QUEUE_POLL_MS);

  // janitor — rescue stuck scans every minute
  setInterval(() => { void rescueStuckScans(); }, 60_000);

  // graceful shutdown
  const shutdown = (sig: string) => {
    console.log(`[scheduler] received ${sig}, shutting down…`);
    shuttingDown = true;
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // also tick once on boot so the scheduler picks up anything queued while it was down
  void pollOnce();
}

start();
