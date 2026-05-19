/**
 * Orchestrates: run every source in parallel-but-bounded, dedupe across sources.
 */
import { pLimit } from '@/lib/pLimit';
import { ALL_SOURCES, getSourceByKey } from '@/sources';
import { dedupe, type DedupedArticle } from './deduplicator';
import { env } from '@/lib/env';
import type { CollectedArticle } from '@/types';

export interface CollectOptions {
  keywords: string[];
  matchMode: 'ANY' | 'ALL';
  projectId?: string;
  sourceKeys?: string[];
  fetchFullContent?: boolean;
  /** Called after each source finishes (success or failure). */
  onSourceDone?: (sourceKey: string, fetched: number, error: string | null) => void;
}

export interface CollectorReport {
  articles: DedupedArticle[];
  perSource: Record<string, { fetched: number; error: string | null }>;
  totalSources: number;
}

export async function collectAll(opts: CollectOptions): Promise<CollectorReport> {
  const sources = opts.sourceKeys?.length
    ? (opts.sourceKeys.map(getSourceByKey).filter(Boolean) as typeof ALL_SOURCES)
    : ALL_SOURCES;

  const limit = pLimit(Math.max(1, env.crawlerConcurrency));
  const perSource: CollectorReport['perSource'] = {};

  const all = await Promise.all(
    sources.map((src) =>
      limit(async () => {
        try {
          const got = await src.collect({
            keywords: opts.keywords,
            matchMode: opts.matchMode,
            projectId: opts.projectId,
            fetchFullContent: opts.fetchFullContent,
          });
          perSource[src.meta.key] = { fetched: got.length, error: null };
          opts.onSourceDone?.(src.meta.key, got.length, null);
          return got;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          perSource[src.meta.key] = { fetched: 0, error: msg };
          opts.onSourceDone?.(src.meta.key, 0, msg);
          return [] as CollectedArticle[];
        }
      }),
    ),
  );

  const flat = all.flat();
  return { articles: dedupe(flat), perSource, totalSources: sources.length };
}
