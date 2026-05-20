/**
 * In-memory progress tracker for active scans.
 *
 * Trade-off: works only in a single Node process. For multi-instance / serverless,
 * swap with Redis (same shape) — every progress mutation goes through `update()`.
 */

export type ScanStage =
  | 'QUEUED'
  | 'COLLECTING'   // hitting RSS + search pages across 16 sources
  | 'PERSISTING'   // writing new mentions to DB
  | 'ANALYZING'    // OpenAI sentiment on unanalyzed mentions
  | 'SCORING'      // reputation + alerts
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

// Persist the in-memory store across Next.js dev HMR module reloads.
// Without this, the Map gets recreated empty on every code change → GET
// /scan polling falls back to "last ScanRun row" which shows static 0%.
const globalForProgress = globalThis as unknown as { __reputaScanProgress?: Map<string, ScanProgressState> };
const store: Map<string, ScanProgressState> =
  globalForProgress.__reputaScanProgress ?? new Map<string, ScanProgressState>();
if (process.env.NODE_ENV !== 'production') globalForProgress.__reputaScanProgress = store;

export function start(projectId: string, scanRunId: string, totalSources: number): ScanProgressState {
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
  store.set(scanRunId, state);
  // also index by projectId for the latest
  store.set(`project:${projectId}`, state);
  return state;
}

export function update(scanRunId: string, patch: Partial<ScanProgressState>) {
  const cur = store.get(scanRunId);
  if (!cur) return;
  const next: ScanProgressState = { ...cur, ...patch, updatedAt: Date.now() };

  // auto-compute percent from stage + sub-progress
  if (patch.stage && patch.percent === undefined) {
    const [lo, hi] = STAGE_WEIGHTS[next.stage];
    next.percent = lo;
  }
  if (next.stage === 'COLLECTING' && next.totalSources > 0) {
    const [lo, hi] = STAGE_WEIGHTS.COLLECTING;
    next.percent = Math.min(hi, lo + ((hi - lo) * next.sourcesDone) / next.totalSources);
  } else if (next.stage === 'ANALYZING' && next.toAnalyze > 0) {
    const [lo, hi] = STAGE_WEIGHTS.ANALYZING;
    next.percent = Math.min(hi, lo + ((hi - lo) * next.analyzed) / next.toAnalyze);
  }
  next.percent = Math.round(next.percent);

  store.set(scanRunId, next);
  store.set(`project:${next.projectId}`, next);
}

export function finish(scanRunId: string, score?: number | null) {
  update(scanRunId, { stage: 'DONE', percent: 100, label: 'Selesai', score });
}

export function fail(scanRunId: string, error: string) {
  update(scanRunId, { stage: 'FAILED', percent: 0, label: 'Gagal', error });
}

export function get(scanRunId: string): ScanProgressState | undefined {
  return store.get(scanRunId);
}

export function getLatestForProject(projectId: string): ScanProgressState | undefined {
  return store.get(`project:${projectId}`);
}
