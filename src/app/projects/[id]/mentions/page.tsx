'use client';

import { use, useEffect, useState } from 'react';
import { SentimentBadge, CrawlStatusBadge } from '@/components/SentimentBadge';
import { ExternalLink } from 'lucide-react';

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

const SENTIMENTS = ['', 'POSITIVE', 'NEUTRAL', 'NEGATIVE'];
const METHODS = ['', 'RSS', 'SEARCH_PAGE', 'ARTICLE_SCRAPE'];

export default function MentionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [items, setItems] = useState<Mention[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ q: '', sentiment: '', source: '', method: '', from: '', to: '' });
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const r = await fetch(`/api/projects/${id}/mentions?${qs.toString()}`);
    const j = await r.json();
    setItems(j.items ?? []);
    setTotal(j.total ?? 0);
    setSources([...new Set((j.items as Mention[] ?? []).map((m) => m.sourceKey))]);
    setLoading(false);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mentions</h1>
          <p className="text-sm text-ink-400">{total.toLocaleString('id-ID')} total mentions</p>
        </div>
      </div>

      <div className="card p-4 mb-4 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
        <div className="col-span-2">
          <label className="label">Search</label>
          <input className="input" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Keyword in title or snippet" />
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
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}>
            {METHODS.map((m) => <option key={m} value={m}>{m || 'All'}</option>)}
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
        <div className="col-span-2 md:col-span-6 flex justify-end">
          <button className="btn-primary" onClick={load} disabled={loading}>Apply filters</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar">
          <table className="dt w-full">
            <thead>
              <tr>
                <th>Date</th><th>Source</th><th>Title</th><th>Sentiment</th><th>Score</th><th>Emotion</th><th>Method</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <tr key={`s-${i}`} className="animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
                  <td><div className="h-3 w-20 bg-ink-700/60 rounded" /></td>
                  <td><div className="h-3 w-20 bg-ink-700/60 rounded" /></td>
                  <td><div className="h-3 w-72 bg-ink-700/60 rounded" /><div className="h-2.5 w-56 bg-ink-700/40 rounded mt-1" /></td>
                  <td><div className="h-4 w-16 bg-ink-700/60 rounded-full" /></td>
                  <td><div className="h-3 w-8 bg-ink-700/60 rounded" /></td>
                  <td><div className="h-3 w-14 bg-ink-700/60 rounded" /></td>
                  <td><div className="h-3 w-12 bg-ink-700/60 rounded" /></td>
                  <td><div className="h-4 w-12 bg-ink-700/60 rounded-full" /></td>
                  <td><div className="h-3 w-4 bg-ink-700/60 rounded" /></td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr><td colSpan={9} className="text-center text-ink-400 py-6">Belum ada mention yang sesuai filter.</td></tr>
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
                  <td className="text-ink-300">{m.sentimentScore != null ? m.sentimentScore.toFixed(2) : '—'}</td>
                  <td className="text-ink-300">{m.emotion ?? '—'}</td>
                  <td className="text-ink-400 text-xs">{m.collectionMethod}</td>
                  <td><CrawlStatusBadge value={m.crawlStatus} /></td>
                  <td><a href={m.url} target="_blank" rel="noreferrer noopener" className="text-accent-400 hover:text-accent-500"><ExternalLink size={14}/></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
