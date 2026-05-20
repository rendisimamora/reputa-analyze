'use client';

import { use, useEffect, useRef, useState } from 'react';
import { FileDown, FileText, RefreshCw } from 'lucide-react';
import { SentimentTrendChart, MentionTrendChart, SourceBarChart } from '@/components/charts';
import { SentimentBadge } from '@/components/SentimentBadge';

interface ReportData {
  project: { name: string };
  reputation: { score: number | null; category: string };
  totals: { mentions: number; positive: number; neutral: number; negative: number };
  trend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
  mentionTrend: Array<{ date: string; count: number }>;
  sourceDistribution: Array<{ source: string; count: number }>;
  topNegativeIssues: Array<{ topic: string; count: number }>;
  topPositiveTopics: Array<{ topic: string; count: number }>;
  recent: Array<{ id: string; title: string; url: string; sourceName: string; sentiment: string | null; aiSummary: string | null; publishedAt: string | null }>;
  aiSummary?: { executive: string; recommendation: string };
  range?: { from: string; to: string };
}

export default function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void generate(); /* eslint-disable-next-line */ }, []);

  async function generate() {
    setLoading(true);
    const r = await fetch(`/api/projects/${slug}/report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const j = await r.json();
    setReport(j.report?.payload ?? null);
    setLoading(false);
  }

  function exportPdf() {
    // Browser print → "Save as PDF" works without any extra dependency.
    window.print();
  }

  return (
    <>
      <style>{`@media print { aside { display: none } main { padding: 0 !important } .no-print { display: none } body { background: white !important; color: black !important } .card { border: 1px solid #ddd !important; background: white !important; box-shadow: none !important } * { color: black !important } }`}</style>

      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><FileText size={20}/> Reputation Report</h1>
          <p className="text-sm text-ink-400">Generated dari data nyata yang telah dikumpulkan.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generate} className="btn-ghost" disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Regenerate</button>
          <button onClick={exportPdf} className="btn-primary"><FileDown size={14}/> Export PDF</button>
        </div>
      </div>

      {!report ? (
        <div className="card p-6 text-sm text-ink-400">Generating report…</div>
      ) : (
        <div ref={printRef} className="space-y-5">
          <div className="card p-6">
            <div className="text-xs uppercase tracking-wider text-ink-400">Subject</div>
            <div className="text-xl font-semibold">{report.project.name}</div>
            <div className="mt-2 grid grid-cols-4 gap-4">
              <div><div className="text-xs text-ink-400">Reputation</div><div className="text-2xl font-bold">{report.reputation.score ?? '—'}</div><div className="text-xs">{report.reputation.category}</div></div>
              <div><div className="text-xs text-ink-400">Mentions</div><div className="text-2xl font-bold">{report.totals.mentions}</div></div>
              <div><div className="text-xs text-ink-400">Positive</div><div className="text-2xl font-bold text-success-500">{report.totals.positive}</div></div>
              <div><div className="text-xs text-ink-400">Negative</div><div className="text-2xl font-bold text-danger-500">{report.totals.negative}</div></div>
            </div>
          </div>

          {report.aiSummary?.executive && (
            <div className="card p-6">
              <div className="text-sm font-medium mb-1">Executive Summary</div>
              <p className="text-sm leading-relaxed">{report.aiSummary.executive}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card p-4 lg:col-span-2"><div className="text-sm font-medium mb-2">Sentiment Trend</div><SentimentTrendChart data={report.trend}/></div>
            <div className="card p-4"><div className="text-sm font-medium mb-2">Mention Trend</div><MentionTrendChart data={report.mentionTrend}/></div>
          </div>

          <div className="card p-4"><div className="text-sm font-medium mb-2">Source Coverage</div><SourceBarChart data={report.sourceDistribution.slice(0, 12).map((s) => ({ source: s.source, count: s.count }))}/></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-4"><div className="text-sm font-medium mb-2">Top Negative Issues</div>{report.topNegativeIssues.map((t) => <div key={t.topic} className="flex justify-between py-1 text-sm border-b border-ink-800 last:border-0"><span>{t.topic}</span><span>{t.count}</span></div>)}</div>
            <div className="card p-4"><div className="text-sm font-medium mb-2">Top Positive Topics</div>{report.topPositiveTopics.map((t) => <div key={t.topic} className="flex justify-between py-1 text-sm border-b border-ink-800 last:border-0"><span>{t.topic}</span><span>{t.count}</span></div>)}</div>
          </div>

          <div className="card p-4">
            <div className="text-sm font-medium mb-2">Mention Samples</div>
            <div className="space-y-3">
              {report.recent.slice(0, 15).map((m) => (
                <div key={m.id} className="border-b border-ink-800 last:border-0 pb-2">
                  <div className="flex items-center gap-2 text-xs text-ink-400"><span>{m.sourceName}</span>·<span>{m.publishedAt ? new Date(m.publishedAt).toLocaleDateString('id-ID') : '—'}</span><SentimentBadge value={m.sentiment}/></div>
                  <a href={m.url} target="_blank" rel="noreferrer noopener" className="text-sm font-medium text-accent-400 hover:underline">{m.title}</a>
                  {m.aiSummary && <div className="text-xs text-ink-300 mt-1">{m.aiSummary}</div>}
                </div>
              ))}
            </div>
          </div>

          {report.aiSummary?.recommendation && (
            <div className="card p-6">
              <div className="text-sm font-medium mb-1">Recommendation</div>
              <p className="text-sm leading-relaxed">{report.aiSummary.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
