'use client';

import { use, useEffect, useState } from 'react';
import { CrawlStatusBadge } from '@/components/SentimentBadge';

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

export default function CrawlLogsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  useEffect(() => {
    fetch(`/api/projects/${id}/crawl-logs?take=300`).then((r) => r.json()).then((d) => setLogs(d.logs ?? []));
  }, [id]);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Crawl Logs</h1>
      <p className="text-sm text-ink-400 mb-6">Setiap fetch ke RSS/halaman publik dicatat untuk audit & debugging.</p>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar">
          <table className="dt w-full">
            <thead>
              <tr><th>Time</th><th>Source</th><th>Method</th><th>Status</th><th>HTTP</th><th>Duration</th><th>URL</th><th>Message</th></tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={8} className="text-center text-ink-400 py-6">No logs.</td></tr>}
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-ink-300">{new Date(l.createdAt).toLocaleString('id-ID')}</td>
                  <td className="text-ink-200">{l.sourceKey}</td>
                  <td className="text-ink-400 text-xs">{l.method}</td>
                  <td><CrawlStatusBadge value={l.status} /></td>
                  <td className="text-ink-300">{l.httpStatus ?? '—'}</td>
                  <td className="text-ink-400">{l.durationMs ? `${l.durationMs}ms` : '—'}</td>
                  <td className="max-w-xs truncate"><a href={l.url} target="_blank" rel="noreferrer noopener" className="text-accent-400 hover:underline">{l.url}</a></td>
                  <td className="text-ink-400 max-w-xs truncate">{l.message ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
