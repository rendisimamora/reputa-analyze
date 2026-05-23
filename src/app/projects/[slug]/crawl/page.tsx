'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CrawlStatusBadge } from '@/components/SentimentBadge';
import { CrawlLogsSkeleton } from '@/components/PageSkeletons';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, X } from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch } from '@/lib/api-client';

interface CrawlLog {
  id: string;
  sourceKey: string;
  method: string;
  url: string;
  status: string;
  httpStatus: number | null;
  message: string | null;
  durationMs: number | null;
  createdAt: string;
}

const METHODS = ['', 'RSS', 'SEARCH_PAGE', 'ARTICLE_SCRAPE'];
const STATUSES = ['', 'OK', 'PARTIAL', 'RESTRICTED', 'RATE_LIMITED', 'ERROR'];
const PAGE_SIZES = [25, 50, 100];

interface Filters {
  source: string;
  method: string;
  status: string;
  from: string;
  to: string;
}

const emptyFilters: Filters = { source: '', method: '', status: '', from: '', to: '' };

export default function CrawlLogsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [logs, setLogs] = useState<CrawlLog[] | null>(null);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [transition, setTransition] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilter = useMemo(
    () => Object.values(filters).some((v) => v !== ''),
    [filters],
  );

  const load = useCallback(
    async (opts: { skipPage?: number; isInitial?: boolean } = {}) => {
      const pageNum = opts.skipPage ?? page;
      if (!opts.isInitial) setTransition(true);

      const qs = new URLSearchParams();
      qs.set('take', String(pageSize));
      qs.set('skip', String(pageNum * pageSize));
      if (filters.source) qs.set('source', filters.source);
      if (filters.method) qs.set('method', filters.method);
      if (filters.status) qs.set('status', filters.status);
      if (filters.from) qs.set('from', filters.from);
      if (filters.to) qs.set('to', filters.to);

      try {
        const r = await apiFetch(`/api/projects/${slug}/crawl-logs?${qs.toString()}`);
        const j = await r.json();
        setLogs(j.items ?? []);
        setTotal(j.total ?? 0);
        if (j.sources && Array.isArray(j.sources)) setSources(j.sources);
      } finally {
        setTransition(false);
      }
    },
    [slug, page, pageSize, filters],
  );

  // Guard against React StrictMode's intentional double-effect-invocation in dev.
  // Refs persist across the double-mount so the second invocation is a no-op.
  const didInit = useRef(false);

  // initial load (runs exactly once even in StrictMode)
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void load({ isInitial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // page / pageSize change — only triggers AFTER initial load completed
  useEffect(() => {
    if (!didInit.current || logs === null) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  function applyFilters() {
    setPage(0);
    void load({ skipPage: 0 });
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setPage(0);
    // run load after state propagates
    setTimeout(() => void load({ skipPage: 0 }), 0);
  }

  if (logs === null) return <CrawlLogsSkeleton />;

  const showingFrom = total === 0 ? 0 : page * pageSize + 1;
  const showingTo = Math.min(total, (page + 1) * pageSize);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Crawl Logs</h1>
          <p className="text-sm text-ink-400">
            Setiap fetch ke RSS/halaman publik dicatat untuk audit & debugging.
            {' · '}
            <span className="text-ink-300">{total.toLocaleString('id-ID')}</span> total entries
          </p>
        </div>
        <button onClick={() => load()} className="btn-ghost" disabled={transition}>
          <RefreshCw size={14} className={transition ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="label">Source</label>
            <select className="input" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
              <option value="">All</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}>
              {METHODS.map((m) => <option key={m} value={m}>{m || 'All'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s || 'All'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end md:col-span-1">
            {hasActiveFilter && (
              <button type="button" onClick={resetFilters} className="btn-ghost" title="Reset filter">
                <X size={14} />
              </button>
            )}
            <button type="button" onClick={applyFilters} className="btn-primary" disabled={transition}>
              {transition ? <Loader2 size={14} className="animate-spin" /> : null}
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={clsx('card overflow-hidden relative transition-opacity', transition && 'opacity-60')}>
        {transition && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-950/40 backdrop-blur-[2px] pointer-events-none">
            <div className="flex items-center gap-2 text-sm text-accent-400 bg-ink-900/90 px-3 py-1.5 rounded-full border border-ink-700">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          </div>
        )}
        <div className="overflow-x-auto scrollbar">
          <table className="dt w-full">
            <thead>
              <tr>
                <th>Time</th><th>Source</th><th>Method</th><th>Status</th>
                <th>HTTP</th><th>Duration</th><th>URL</th><th>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={8} className="text-center text-ink-400 py-8">
                  {hasActiveFilter ? 'Tidak ada log yang sesuai filter.' : 'Belum ada log. Jalankan scan dulu.'}
                </td></tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-ink-800/30">
                  <td className="whitespace-nowrap text-ink-300">{new Date(l.createdAt).toLocaleString('id-ID')}</td>
                  <td className="text-ink-200">{l.sourceKey}</td>
                  <td className="text-ink-400 text-xs">{l.method}</td>
                  <td><CrawlStatusBadge value={l.status} /></td>
                  <td className="text-ink-300 tabular-nums">{l.httpStatus ?? '—'}</td>
                  <td className="text-ink-400 tabular-nums">{l.durationMs ? `${l.durationMs}ms` : '—'}</td>
                  <td className="max-w-xs truncate"><a href={l.url} target="_blank" rel="noreferrer noopener" className="text-accent-400 hover:underline">{l.url}</a></td>
                  <td className="text-ink-400 max-w-xs truncate">{l.message ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm">
        <div className="text-ink-400">
          {total === 0 ? 'Tidak ada data' : (
            <>Menampilkan <span className="text-ink-200">{showingFrom}-{showingTo}</span> dari <span className="text-ink-200">{total.toLocaleString('id-ID')}</span></>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-400">Rows per page</span>
            <select
              className="input py-1 px-2 text-xs w-auto"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              disabled={transition}
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || transition}
              className="btn-ghost px-2 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="text-xs text-ink-300 tabular-nums px-2">
              {page + 1} / {totalPages}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || transition}
              className="btn-ghost px-2 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
