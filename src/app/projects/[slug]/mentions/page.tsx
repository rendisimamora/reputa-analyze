'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SentimentBadge, CrawlStatusBadge } from '@/components/SentimentBadge';
import { MentionsTableSkeleton } from '@/components/PageSkeletons';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch } from '@/lib/api-client';
import { safeUrl } from '@/lib/safe-url';

interface Mention {
  id: string;
  title: string;
  snippet: string | null;
  url: string;
  sourceName: string;
  sourceKey: string;
  publishedAt: string | null;
  sentiment: string | null;
  sentimentScore: number | null;
  emotion: string | null;
  collectionMethod: string;
  crawlStatus: string;
}

interface SourceOpt { key: string; name: string }

const SENTIMENTS = ['', 'POSITIVE', 'NEUTRAL', 'NEGATIVE'];
const METHODS = ['', 'RSS', 'SEARCH_PAGE', 'ARTICLE_SCRAPE'];
const STATUSES = ['', 'OK', 'PARTIAL', 'RESTRICTED', 'RATE_LIMITED', 'ERROR'];
const PAGE_SIZES = [25, 50, 100];

interface Filters {
  q: string;
  sentiment: string;
  source: string;
  method: string;
  status: string;
  from: string;
  to: string;
}

const emptyFilters: Filters = { q: '', sentiment: '', source: '', method: '', status: '', from: '', to: '' };

export default function MentionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [items, setItems] = useState<Mention[] | null>(null);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<SourceOpt[]>([]);
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
      if (filters.q) qs.set('q', filters.q);
      if (filters.sentiment) qs.set('sentiment', filters.sentiment);
      if (filters.source) qs.set('source', filters.source);
      if (filters.method) qs.set('method', filters.method);
      if (filters.status) qs.set('status', filters.status);
      if (filters.from) qs.set('from', filters.from);
      if (filters.to) qs.set('to', filters.to);

      try {
        const r = await apiFetch(`/api/projects/${slug}/mentions?${qs.toString()}`);
        const j = await r.json();
        setItems(j.items ?? []);
        setTotal(j.total ?? 0);
        if (Array.isArray(j.sources)) setSources(j.sources);
      } finally {
        setTransition(false);
      }
    },
    [slug, page, pageSize, filters],
  );

  // StrictMode guard
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void load({ isInitial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // page / pageSize change
  useEffect(() => {
    if (!didInit.current || items === null) return;
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
    setTimeout(() => void load({ skipPage: 0 }), 0);
  }

  if (items === null) return <MentionsTableSkeleton />;

  const showingFrom = total === 0 ? 0 : page * pageSize + 1;
  const showingTo = Math.min(total, (page + 1) * pageSize);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mentions</h1>
          <p className="text-sm text-ink-400">
            <span className="text-ink-200">{total.toLocaleString('id-ID')}</span> total mentions
          </p>
        </div>
        <button onClick={() => load()} className="btn-ghost" disabled={transition}>
          <RefreshCw size={14} className={transition ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="card p-4 mb-4 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
        <div className="col-span-2">
          <label className="label">Search</label>
          <input
            className="input"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
            placeholder="Keyword in title or snippet"
          />
        </div>
        <div>
          <label className="label">Sentiment</label>
          <select className="input" value={filters.sentiment} onChange={(e) => setFilters({ ...filters, sentiment: e.target.value })}>
            {SENTIMENTS.map((s) => <option key={s} value={s}>{s || 'All'}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Source</label>
          <select className="input" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
            <option value="">All</option>
            {sources.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
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
        <div className="grid grid-cols-2 gap-2 col-span-2">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })}/>
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })}/>
          </div>
        </div>
        <div className="col-span-2 md:col-span-6 flex justify-end gap-2">
          {hasActiveFilter && (
            <button type="button" onClick={resetFilters} className="btn-ghost" title="Reset filter">
              <X size={14} /> Reset
            </button>
          )}
          <button type="button" onClick={applyFilters} className="btn-primary" disabled={transition}>
            {transition ? <Loader2 size={14} className="animate-spin" /> : null}
            Apply filters
          </button>
        </div>
      </div>

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
                <th>Date</th><th>Source</th><th>Title</th><th>Sentiment</th><th>Score</th><th>Emotion</th><th>Method</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={9} className="text-center text-ink-400 py-8">
                  {hasActiveFilter ? 'Tidak ada mention yang sesuai filter.' : 'Belum ada mention. Jalankan scan dulu.'}
                </td></tr>
              )}
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-ink-800/30">
                  <td className="whitespace-nowrap text-ink-300">{m.publishedAt ? new Date(m.publishedAt).toLocaleDateString('id-ID') : '—'}</td>
                  <td className="text-ink-200 whitespace-nowrap">{m.sourceName}</td>
                  <td className="max-w-md">
                    <div className="text-ink-100 line-clamp-1">{m.title}</div>
                    {m.snippet && <div className="text-xs text-ink-400 line-clamp-1">{m.snippet}</div>}
                  </td>
                  <td><SentimentBadge value={m.sentiment} /></td>
                  <td className="text-ink-300 tabular-nums">{m.sentimentScore != null ? m.sentimentScore.toFixed(2) : '—'}</td>
                  <td className="text-ink-300">{m.emotion ?? '—'}</td>
                  <td className="text-ink-400 text-xs">{m.collectionMethod}</td>
                  <td><CrawlStatusBadge value={m.crawlStatus} /></td>
                  <td><a href={safeUrl(m.url)} target="_blank" rel="noreferrer noopener" className="text-accent-400 hover:text-accent-500"><ExternalLink size={14}/></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
