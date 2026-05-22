'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/StatCard';
import { SentimentBadge, CrawlStatusBadge } from '@/components/SentimentBadge';
import { SentimentTrendChart, MentionTrendChart, SourceBarChart, SentimentPie } from '@/components/charts';
import { ScanProgressBar, type ScanProgress } from '@/components/ScanProgressBar';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { HelpTooltip } from '@/components/Tooltip';
import { AlertTriangle, ArrowRight, BarChart3, BrainCircuit, MessageSquare, RefreshCw, ShieldAlert, ThumbsDown, ThumbsUp, Sparkles } from 'lucide-react';

interface DashboardData {
  project: { id: string; name: string; description: string | null; lastScanAt: string | null };
  reputation: { score: number | null; category: 'Excellent' | 'Good' | 'Risky' | 'Critical' | 'No data'; counts: { total: number; analyzed: number; positive: number; neutral: number; negative: number; distinctSources: number } };
  totals: { mentions: number; analyzed: number; positive: number; neutral: number; negative: number };
  aiSummaryError?: string;
  trend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
  mentionTrend: Array<{ date: string; count: number }>;
  sourceDistribution: Array<{ source: string; sourceKey: string; count: number }>;
  topPositiveTopics: Array<{ topic: string; count: number }>;
  topNegativeIssues: Array<{ topic: string; count: number }>;
  sourceHealth: Array<{ sourceKey: string; lastStatus: string; lastFetchedAt: string | null; errors: number }>;
  recent: Array<{ id: string; title: string; url: string; sourceName: string; publishedAt: string | null; sentiment: string | null; sentimentScore: number | null }>;
  aiSummary?: { executive: string; recommendation: string; generatedAt: string | null };
}

export default function ProjectDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<DashboardData | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeMsg, setReanalyzeMsg] = useState<string | null>(null);
  const [regenSummary, setRegenSummary] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (withAi = false) => {
    const url = `/api/projects/${slug}/dashboard${withAi ? '?ai=1' : ''}`;
    try {
      const r = await fetch(url);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ? `Gagal memuat dashboard: ${j.error}` : 'Gagal memuat dashboard');
        return;
      }
      const json = await r.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? `Gagal memuat dashboard: ${e.message}` : 'Gagal memuat dashboard');
    }
  }, [slug]);

  // StrictMode guard — initial dashboard fetch + initial-progress probe happen
  // exactly once. Cleanup still runs on real unmount via pollRef.current check.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) {
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
    didInit.current = true;
    void load(true);
    void checkInitialProgress();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkInitialProgress() {
    // Resume polling only if there is a *genuinely* active scan. Ignore stale
    // RUNNING rows (worker died, or no worker is online yet) so we don't show
    // a phantom "Scanning…" spinner on every dashboard mount.
    try {
      const r = await fetch(`/api/projects/${slug}/scan`);
      const j = await r.json();
      const p = j.progress;
      if (!p) return;
      const STALE_MS = 90 * 1000;
      if (typeof p.updatedAt === 'number' && Date.now() - p.updatedAt > STALE_MS) return;
      if (p.stage === 'DONE' || p.stage === 'FAILED') return;
      setProgress(p);
      startPolling(p.scanRunId);
    } catch {
      /* silent — no active scan or worker offline */
    }
  }

  function startPolling(scanRunId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/projects/${slug}/scan?scanRunId=${scanRunId}`);
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
    const r = await fetch(`/api/projects/${slug}/scan`, { method: 'POST' });
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? 'Scan failed'); return; }
    const { scanRunId } = await r.json();
    setProgress({
      scanRunId, stage: 'QUEUED', percent: 0, label: 'Memulai…',
      totalSources: 16, sourcesDone: 0, fetched: 0, toAnalyze: 0, analyzed: 0,
    });
    startPolling(scanRunId);
  }

  async function regenerateSummary() {
    setRegenSummary(true);
    try {
      const r = await fetch(`/api/projects/${slug}/summary`, { method: 'POST' });
      if (r.ok) await load(false);
    } finally {
      setRegenSummary(false);
    }
  }

  async function reanalyze() {
    setReanalyzing(true);
    setReanalyzeMsg(null);
    try {
      const r = await fetch(`/api/projects/${slug}/reanalyze`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) {
        setReanalyzeMsg(j.error ?? 'Re-analyze gagal');
      } else {
        setReanalyzeMsg(`Berhasil: ${j.analyzed}/${j.total} mention dianalisis${j.errors ? ` (${j.errors} error)` : ''}.`);
        await load(true);
      }
    } catch (e) {
      setReanalyzeMsg(e instanceof Error ? e.message : 'Re-analyze gagal');
    } finally {
      setReanalyzing(false);
    }
  }

  const score = data?.reputation.score ?? null;
  const tone = score === null ? 'default' : score >= 80 ? 'good' : score >= 60 ? 'default' : score >= 40 ? 'warn' : 'bad';
  const scanning = progress && progress.stage !== 'DONE' && progress.stage !== 'FAILED';
  const pending = data ? Math.max(0, data.totals.mentions - data.totals.analyzed) : 0;

  // Initial load — show skeleton while we wait for first dashboard payload
  if (!data && !error) {
    return (
      <>
        {progress && <ScanProgressBar progress={progress} />}
        <DashboardSkeleton />
      </>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data?.project.name ?? 'Project'}</h1>
          <p className="text-sm text-ink-400">
            {data?.project.description || 'Real-time reputation intelligence dari media Indonesia.'}
          </p>
          <div className="text-xs text-ink-500 mt-1">
            Last scan: {data?.project.lastScanAt ? new Date(data.project.lastScanAt).toLocaleString('id-ID') : 'belum pernah'}
          </div>
        </div>
        <button onClick={runScan} className="btn-primary" disabled={!!scanning}>
          <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
          {scanning
            ? progress?.stage === 'QUEUED'
              ? 'Menunggu worker…'
              : `Scanning… ${progress?.percent ?? 0}%`
            : 'Scan now'}
        </button>
      </div>

      {progress && <ScanProgressBar progress={progress} />}
      {error && <div className="card border-danger-500/40 bg-danger-500/5 text-sm text-danger-500 p-3 mb-4">{error}</div>}

      {pending > 0 && (
        <div className="card border-warning-500/40 bg-warning-500/5 p-4 mb-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-warning-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-ink-100">{pending} mention belum dianalisis sentimen</div>
              <div className="text-xs text-ink-300 mt-0.5">
                AI sentiment analysis terlewat (kemungkinan OpenAI key/quota saat scan terakhir). Klik tombol di samping untuk re-analyze.
              </div>
              {reanalyzeMsg && <div className="text-xs text-accent-400 mt-1">{reanalyzeMsg}</div>}
            </div>
          </div>
          <button onClick={reanalyze} className="btn-primary shrink-0" disabled={reanalyzing}>
            <BrainCircuit size={14} className={reanalyzing ? 'animate-pulse' : ''}/>
            {reanalyzing ? 'Analyzing…' : `Re-analyze ${pending}`}
          </button>
        </div>
      )}

      {data?.aiSummaryError && (
        <div className="card border-warning-500/30 bg-warning-500/5 p-3 mb-4 text-xs text-warning-500">
          ⚠ AI executive summary tidak tersedia: {data.aiSummaryError}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card-glow p-4">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-ink-300">
            Reputation Score
            <HelpTooltip text="Skor 0–100 yang menggabungkan rasio sentimen positif/negatif (40%), volume mention (15%), kredibilitas media (15%), keragaman sumber (10%), recency (10%), dikurangi penalti tren negatif (10%). Kategori: 80–100 Excellent · 60–79 Good · 40–59 Risky · 0–39 Critical." />
          </div>
          <div className={`mt-2 text-4xl font-bold ${score === null ? 'text-ink-500' : tone === 'good' ? 'text-success-500' : tone === 'warn' ? 'text-warning-500' : tone === 'bad' ? 'text-danger-500' : 'text-accent-400'}`}>
            {score === null ? '—' : score}
          </div>
          <div className="mt-1 text-xs text-ink-300">
            {score === null ? `Butuh ≥3 mention dianalisis (${data?.reputation.counts.analyzed ?? 0} so far)` : data?.reputation.category}
          </div>
        </div>
        <StatCard
          label="Total Mentions"
          value={data?.totals.mentions ?? 0}
          Icon={MessageSquare}
          tooltip="Jumlah seluruh artikel yang berhasil dikumpulkan dari RSS & halaman publik media Indonesia untuk project ini (sudah di-dedupe)."
        />
        <StatCard
          label="Positive"
          value={data?.totals.positive ?? 0}
          Icon={ThumbsUp}
          tone="good"
          tooltip="Mention yang menggambarkan subjek dalam konteks baik: prestasi, penghargaan, pertumbuhan, ekspansi, inovasi, dukungan publik. Skor AI > 0."
        />
        <StatCard
          label="Negative"
          value={data?.totals.negative ?? 0}
          Icon={ThumbsDown}
          tone="bad"
          tooltip="Mention berisi kontroversi, kritik, skandal, kasus hukum, kerugian, kegagalan, atau isu etika yang merugikan subjek. Skor AI < 0."
        />
      </div>

      {data?.aiSummary && (data.aiSummary.executive || data.aiSummary.recommendation) && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-accent-400">
              <BrainCircuit size={16}/> AI Executive Summary
            </div>
            <div className="flex items-center gap-3">
              {data.aiSummary.generatedAt && (
                <span className="text-[11px] text-ink-500" title="Disimpan di DB sejak generate terakhir — tidak hit AI tiap load.">
                  Cached · {new Date(data.aiSummary.generatedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              )}
              <button
                onClick={regenerateSummary}
                disabled={regenSummary}
                className="text-xs text-ink-300 hover:text-accent-400 inline-flex items-center gap-1 disabled:opacity-50"
                title="Generate ulang summary menggunakan AI"
              >
                <RefreshCw size={12} className={regenSummary ? 'animate-spin' : ''}/>
                {regenSummary ? 'Generating…' : 'Regenerate'}
              </button>
            </div>
          </div>
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
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Crawl Status per Source</div>
            <Link
              href={`/projects/${slug}/crawl`}
              className="text-xs text-accent-400 hover:text-accent-500 inline-flex items-center gap-1"
            >
              Lihat semua <ArrowRight size={12} />
            </Link>
          </div>
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
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Recent Mentions</div>
            <Link
              href={`/projects/${slug}/mentions`}
              className="text-xs text-accent-400 hover:text-accent-500 inline-flex items-center gap-1"
            >
              Lihat semua <ArrowRight size={12} />
            </Link>
          </div>
          <div className="max-h-72 overflow-auto scrollbar space-y-2">
            {data?.recent.length ? data.recent.slice(0, 10).map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer noopener" className="block rounded-md hover:bg-ink-800/60 p-2 -m-2">
                <div className="flex items-center gap-2 text-xs text-ink-400"><span>{m.sourceName}</span>·<span>{m.publishedAt ? new Date(m.publishedAt).toLocaleDateString('id-ID') : '—'}</span><SentimentBadge value={m.sentiment} /></div>
                <div className="text-sm text-ink-100 line-clamp-2">{m.title}</div>
              </a>
            )) : <div className="text-xs text-ink-400">Belum ada mention.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
