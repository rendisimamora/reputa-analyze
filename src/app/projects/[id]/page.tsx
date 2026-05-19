'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import { StatCard } from '@/components/StatCard';
import { SentimentBadge, CrawlStatusBadge } from '@/components/SentimentBadge';
import { SentimentTrendChart, MentionTrendChart, SourceBarChart, SentimentPie } from '@/components/charts';
import { ScanProgressBar, type ScanProgress } from '@/components/ScanProgressBar';
import { AlertTriangle, BarChart3, BrainCircuit, MessageSquare, RefreshCw, ShieldAlert, ThumbsDown, ThumbsUp } from 'lucide-react';

interface DashboardData {
  project: { id: string; name: string; description: string | null; lastScanAt: string | null };
  reputation: { score: number; category: 'Excellent' | 'Good' | 'Risky' | 'Critical'; counts: { total: number; positive: number; neutral: number; negative: number; distinctSources: number } };
  totals: { mentions: number; positive: number; neutral: number; negative: number };
  trend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
  mentionTrend: Array<{ date: string; count: number }>;
  sourceDistribution: Array<{ source: string; sourceKey: string; count: number }>;
  topPositiveTopics: Array<{ topic: string; count: number }>;
  topNegativeIssues: Array<{ topic: string; count: number }>;
  sourceHealth: Array<{ sourceKey: string; lastStatus: string; lastFetchedAt: string | null; errors: number }>;
  recent: Array<{ id: string; title: string; url: string; sourceName: string; publishedAt: string | null; sentiment: string | null; sentimentScore: number | null }>;
  aiSummary?: { executive: string; recommendation: string };
}

export default function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<DashboardData | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (withAi = false) => {
    const url = `/api/projects/${id}/dashboard${withAi ? '?ai=1' : ''}`;
    const r = await fetch(url);
    if (!r.ok) { setError('Failed to load dashboard'); return; }
    setData(await r.json());
  }, [id]);

  useEffect(() => {
    void load(true);
    // resume polling if there's an active scan
    void checkInitialProgress();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function checkInitialProgress() {
    const r = await fetch(`/api/projects/${id}/scan`);
    const j = await r.json();
    if (j.progress && j.progress.stage !== 'DONE' && j.progress.stage !== 'FAILED') {
      setProgress(j.progress);
      startPolling(j.progress.scanRunId);
    }
  }

  function startPolling(scanRunId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/projects/${id}/scan?scanRunId=${scanRunId}`);
        const j = await r.json();
        if (j.progress) {
          setProgress(j.progress);
          if (j.progress.stage === 'DONE' || j.progress.stage === 'FAILED') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            if (j.progress.stage === 'DONE') {
              await load(true);
              // auto-hide progress 6s after done
              setTimeout(() => setProgress(null), 6000);
            }
          }
        }
      } catch { /* silent retry */ }
    }, 1200);
  }

  async function runScan() {
    setError(null);
    const r = await fetch(`/api/projects/${id}/scan`, { method: 'POST' });
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? 'Scan failed'); return; }
    const { scanRunId } = await r.json();
    setProgress({
      scanRunId, stage: 'QUEUED', percent: 0, label: 'Memulai…',
      totalSources: 16, sourcesDone: 0, fetched: 0, toAnalyze: 0, analyzed: 0,
    });
    startPolling(scanRunId);
  }

  const score = data?.reputation.score ?? 0;
  const tone = score >= 80 ? 'good' : score >= 60 ? 'default' : score >= 40 ? 'warn' : 'bad';
  const scanning = progress && progress.stage !== 'DONE' && progress.stage !== 'FAILED';

  return (
    <AppShell projectId={id}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data?.project.name ?? 'Loading…'}</h1>
          <p className="text-sm text-ink-400">
            {data?.project.description || 'Real-time reputation intelligence dari media Indonesia.'}
          </p>
          <div className="text-xs text-ink-500 mt-1">
            Last scan: {data?.project.lastScanAt ? new Date(data.project.lastScanAt).toLocaleString('id-ID') : 'belum pernah'}
          </div>
        </div>
        <button onClick={runScan} className="btn-primary" disabled={!!scanning}>
          <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
          {scanning ? `Scanning… ${progress?.percent ?? 0}%` : 'Scan now'}
        </button>
      </div>

      {progress && <ScanProgressBar progress={progress} />}
      {error && <div className="card border-danger-500/40 bg-danger-500/5 text-sm text-danger-500 p-3 mb-4">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card-glow p-4">
          <div className="text-xs uppercase tracking-wider text-ink-300">Reputation Score</div>
          <div className={`mt-2 text-4xl font-bold ${tone === 'good' ? 'text-success-500' : tone === 'warn' ? 'text-warning-500' : tone === 'bad' ? 'text-danger-500' : 'text-accent-400'}`}>
            {score}
          </div>
          <div className="mt-1 text-xs text-ink-300">{data?.reputation.category ?? '—'}</div>
        </div>
        <StatCard label="Total Mentions" value={data?.totals.mentions ?? 0} Icon={MessageSquare} />
        <StatCard label="Positive" value={data?.totals.positive ?? 0} Icon={ThumbsUp} tone="good" />
        <StatCard label="Negative" value={data?.totals.negative ?? 0} Icon={ThumbsDown} tone="bad" />
      </div>

      {data?.aiSummary && (data.aiSummary.executive || data.aiSummary.recommendation) && (
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-2 text-sm text-accent-400 mb-2"><BrainCircuit size={16}/> AI Executive Summary</div>
          <p className="text-sm text-ink-100 leading-relaxed">{data.aiSummary.executive}</p>
          {data.aiSummary.recommendation && (
            <>
              <div className="mt-4 text-xs uppercase tracking-wider text-ink-300 flex items-center gap-2"><ShieldAlert size={14}/> Recommendation</div>
              <p className="text-sm text-ink-200 leading-relaxed">{data.aiSummary.recommendation}</p>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-2"><div className="text-sm font-medium">Sentiment Trend (14d)</div><BarChart3 size={14} className="text-ink-400"/></div>
          {data ? <SentimentTrendChart data={data.trend} /> : <div className="h-48" />}
        </div>
        <div className="card p-4">
          <div className="text-sm font-medium mb-2">Sentiment Mix</div>
          {data ? <SentimentPie pos={data.totals.positive} neu={data.totals.neutral} neg={data.totals.negative} /> : <div className="h-48" />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 lg:col-span-2">
          <div className="text-sm font-medium mb-2">Mention Trend (14d)</div>
          {data ? <MentionTrendChart data={data.mentionTrend} /> : <div className="h-48" />}
        </div>
        <div className="card p-4">
          <div className="text-sm font-medium mb-2">Source Distribution</div>
          {data ? <SourceBarChart data={data.sourceDistribution.slice(0, 10).map((s) => ({ source: s.source, count: s.count }))} /> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-sm font-medium mb-3 flex items-center gap-2"><ThumbsUp size={14} className="text-success-500"/> Top Positive Topics</div>
          {data?.topPositiveTopics.length ? data.topPositiveTopics.map((t) => (
            <div key={t.topic} className="flex justify-between text-sm py-1 border-b border-ink-800 last:border-0">
              <span className="text-ink-100 truncate">{t.topic}</span>
              <span className="text-ink-400">{t.count}</span>
            </div>
          )) : <div className="text-xs text-ink-400">Belum ada data.</div>}
        </div>
        <div className="card p-4">
          <div className="text-sm font-medium mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-danger-500"/> Top Negative Issues</div>
          {data?.topNegativeIssues.length ? data.topNegativeIssues.map((t) => (
            <div key={t.topic} className="flex justify-between text-sm py-1 border-b border-ink-800 last:border-0">
              <span className="text-ink-100 truncate">{t.topic}</span>
              <span className="text-ink-400">{t.count}</span>
            </div>
          )) : <div className="text-xs text-ink-400">Belum ada data.</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-sm font-medium mb-3">Crawl Status per Source</div>
          <div className="max-h-72 overflow-auto scrollbar">
            <table className="dt w-full">
              <thead><tr><th>Source</th><th>Status</th><th>Errors</th><th>Last fetch</th></tr></thead>
              <tbody>
                {data?.sourceHealth.length ? data.sourceHealth.map((s) => (
                  <tr key={s.sourceKey}>
                    <td className="text-ink-100">{s.sourceKey}</td>
                    <td><CrawlStatusBadge value={s.lastStatus} /></td>
                    <td className="text-ink-400">{s.errors}</td>
                    <td className="text-ink-400">{s.lastFetchedAt ? new Date(s.lastFetchedAt).toLocaleString('id-ID') : '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="text-ink-400 text-xs">No data yet — jalankan scan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm font-medium mb-3">Recent Mentions</div>
          <div className="max-h-72 overflow-auto scrollbar space-y-2">
            {data?.recent.length ? data.recent.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer noopener" className="block rounded-md hover:bg-ink-800/60 p-2 -m-2">
                <div className="flex items-center gap-2 text-xs text-ink-400"><span>{m.sourceName}</span>·<span>{m.publishedAt ? new Date(m.publishedAt).toLocaleDateString('id-ID') : '—'}</span><SentimentBadge value={m.sentiment} /></div>
                <div className="text-sm text-ink-100 line-clamp-2">{m.title}</div>
              </a>
            )) : <div className="text-xs text-ink-400">Belum ada mention.</div>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
