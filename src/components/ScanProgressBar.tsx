'use client';

import { clsx } from 'clsx';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export interface ScanProgress {
  scanRunId: string;
  stage: 'QUEUED' | 'COLLECTING' | 'PERSISTING' | 'ANALYZING' | 'SCORING' | 'DONE' | 'FAILED';
  percent: number;
  label: string;
  totalSources: number;
  sourcesDone: number;
  fetched: number;
  toAnalyze: number;
  analyzed: number;
  error?: string;
  score?: number;
}

const STAGE_ORDER: Array<ScanProgress['stage']> = ['COLLECTING', 'PERSISTING', 'ANALYZING', 'SCORING', 'DONE'];
const STAGE_LABEL: Record<ScanProgress['stage'], string> = {
  QUEUED: 'Queued',
  COLLECTING: 'Crawl',
  PERSISTING: 'Persist',
  ANALYZING: 'Analyze',
  SCORING: 'Score',
  DONE: 'Done',
  FAILED: 'Failed',
};

export function ScanProgressBar({ progress }: { progress: ScanProgress }) {
  const failed = progress.stage === 'FAILED';
  const done = progress.stage === 'DONE';
  const activeIdx = STAGE_ORDER.indexOf(progress.stage);

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {failed ? (
            <AlertCircle size={16} className="text-danger-500" />
          ) : done ? (
            <CheckCircle2 size={16} className="text-success-500" />
          ) : (
            <Loader2 size={16} className="text-accent-400 animate-spin" />
          )}
          <div className="text-sm font-medium">
            {failed ? 'Scan gagal' : done ? 'Scan selesai' : 'Scan sedang berjalan'}
          </div>
        </div>
        <div className={clsx(
          'text-2xl font-bold tabular-nums',
          failed ? 'text-danger-500' : done ? 'text-success-500' : 'text-accent-400',
        )}>
          {progress.percent}%
        </div>
      </div>

      <div className="h-2 bg-ink-900 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full transition-all duration-500 ease-out',
            failed ? 'bg-danger-500' : done ? 'bg-success-500' : 'bg-gradient-to-r from-accent-500 to-accent-400',
          )}
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="mt-3 text-xs text-ink-300">{progress.label}</div>

      <div className="mt-3 grid grid-cols-5 gap-1">
        {STAGE_ORDER.map((s, i) => (
          <div
            key={s}
            className={clsx(
              'text-[10px] text-center uppercase tracking-wider py-1 rounded',
              i < activeIdx || done ? 'text-success-500 bg-success-500/5'
                : i === activeIdx ? 'text-accent-400 bg-accent-500/10'
                : 'text-ink-500 bg-ink-900/40',
            )}
          >
            {STAGE_LABEL[s]}
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 text-xs text-center text-ink-300 border-t border-ink-800 pt-3">
        <div>
          <div className="text-base text-ink-100 font-semibold">{progress.sourcesDone}/{progress.totalSources}</div>
          <div>sources scanned</div>
        </div>
        <div>
          <div className="text-base text-ink-100 font-semibold">{progress.fetched}</div>
          <div>mentions found</div>
        </div>
        <div>
          <div className="text-base text-ink-100 font-semibold">{progress.analyzed}/{progress.toAnalyze}</div>
          <div>AI analyzed</div>
        </div>
      </div>

      {progress.error && (
        <div className="mt-3 text-xs text-danger-500 border-t border-ink-800 pt-2">{progress.error}</div>
      )}
    </div>
  );
}
