/**
 * DB-backed progress tracker for active scans.
 *
 * Previously this was an in-memory Map living inside the Next.js process. After
 * decoupling the scanner into a standalone scheduler process (PM2 on VM), both
 * the worker and the Next.js GET endpoint need to see the same state — so we
 * persist progress to ScanRun.progressJson on every update.
 *
 * Update frequency is bounded (~16 source ticks + ~100 analyzer ticks per scan),
 * which is fine for direct DB writes. If this becomes a hotspot we can debounce
 * inside the worker or move to Redis.
 */
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type ScanStage =
  | 'QUEUED'
  | 'COLLECTING'
  | 'PERSISTING'
  | 'ANALYZING'
  | 'SCORING'
  | 'DONE'
  | 'FAILED';

export interface ScanProgressState {
  scanRunId: string;
  projectId: string;
  stage: ScanStage;
  percent: number;            // 0..100
  label: string;
  totalSources: number;
  sourcesDone: number;
  fetched: number;
  toAnalyze: number;
  analyzed: number;
  score?: number | null;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

const STAGE_WEIGHTS: Record<ScanStage, [number, number]> = {
  QUEUED: [0, 2],
  COLLECTING: [2, 55],
  PERSISTING: [55, 65],
  ANALYZING: [65, 92],
  SCORING: [92, 99],
  DONE: [100, 100],
  FAILED: [0, 0],
};

function recompute(state: ScanProgressState): ScanProgressState {
  const next = { ...state, updatedAt: Date.now() };
  if (next.stage === 'COLLECTING' && next.totalSources > 0) {
    const [lo, hi] = STAGE_WEIGHTS.COLLECTING;
    next.percent = Math.min(hi, lo + ((hi - lo) * next.sourcesDone) / next.totalSources);
  } else if (next.stage === 'ANALYZING' && next.toAnalyze > 0) {
    const [lo, hi] = STAGE_WEIGHTS.ANALYZING;
    next.percent = Math.min(hi, lo + ((hi - lo) * next.analyzed) / next.toAnalyze);
  } else {
    next.percent = STAGE_WEIGHTS[next.stage][0];
  }
  next.percent = Math.round(next.percent);
  return next;
}

async function write(scanRunId: string, state: ScanProgressState) {
  await prisma.scanRun.update({
    where: { id: scanRunId },
    data: { progressJson: state as unknown as Prisma.InputJsonValue },
  }).catch((e) => {
    console.warn('[scanProgress] write failed:', e instanceof Error ? e.message : e);
  });
}

export async function start(projectId: string, scanRunId: string, totalSources: number): Promise<ScanProgressState> {
  const state: ScanProgressState = {
    scanRunId,
    projectId,
    stage: 'QUEUED',
    percent: 0,
    label: 'Menyiapkan scan…',
    totalSources,
    sourcesDone: 0,
    fetched: 0,
    toAnalyze: 0,
    analyzed: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
  await write(scanRunId, state);
  return state;
}

export async function update(scanRunId: string, patch: Partial<ScanProgressState>): Promise<void> {
  const cur = await get(scanRunId);
  if (!cur) return;
  const merged: ScanProgressState = { ...cur, ...patch };
  const next = recompute(merged);
  await write(scanRunId, next);
}

export async function finish(scanRunId: string, score?: number | null): Promise<void> {
  const cur = await get(scanRunId);
  if (!cur) return;
  const next: ScanProgressState = { ...cur, stage: 'DONE', percent: 100, label: 'Selesai', score: score ?? null, updatedAt: Date.now() };
  await write(scanRunId, next);
}

export async function fail(scanRunId: string, error: string): Promise<void> {
  const cur = await get(scanRunId);
  if (!cur) return;
  const next: ScanProgressState = { ...cur, stage: 'FAILED', percent: 0, label: 'Gagal', error, updatedAt: Date.now() };
  await write(scanRunId, next);
}

export async function get(scanRunId: string): Promise<ScanProgressState | undefined> {
  const row = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    select: { id: true, projectId: true, progressJson: true, status: true, startedAt: true },
  });
  if (!row) return undefined;
  if (row.progressJson && typeof row.progressJson === 'object' && !Array.isArray(row.progressJson)) {
    return row.progressJson as unknown as ScanProgressState;
  }
  // Synthesize from status if no progressJson yet
  const stage: ScanStage =
    row.status === 'QUEUED' ? 'QUEUED' :
    row.status === 'RUNNING' ? 'COLLECTING' :
    row.status === 'SUCCESS' || row.status === 'PARTIAL' ? 'DONE' :
    'FAILED';
  return {
    scanRunId: row.id,
    projectId: row.projectId,
    stage,
    percent: stage === 'DONE' ? 100 : 0,
    label: stage === 'QUEUED' ? 'Menunggu worker…' : stage === 'DONE' ? 'Selesai' : 'Berjalan…',
    totalSources: 16,
    sourcesDone: 0,
    fetched: 0,
    toAnalyze: 0,
    analyzed: 0,
    startedAt: row.startedAt.getTime(),
    updatedAt: Date.now(),
  };
}

export async function getLatestForProject(projectId: string): Promise<ScanProgressState | undefined> {
  const row = await prisma.scanRun.findFirst({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
    select: { id: true },
  });
  if (!row) return undefined;
  return get(row.id);
}
