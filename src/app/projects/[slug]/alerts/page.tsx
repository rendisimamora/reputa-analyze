'use client';

import { use, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Bell, Check, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { AlertsSkeleton } from '@/components/PageSkeletons';

interface AlertSample {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  sentimentScore: number | null;
}

interface AlertPayload {
  samples?: AlertSample[];
  mentionIds?: string[];
  sources?: string[];
  [k: string]: unknown;
}

interface Alert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
  payload?: AlertPayload | null;
}

export default function AlertsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Guard against React StrictMode's double-mount in dev — otherwise the
  // alerts list is fetched twice on every page open. The ref persists across
  // the double-invoke so the second call is a no-op.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const r = await fetch(`/api/projects/${slug}/alerts`);
    const j = await r.json();
    setAlerts(j.alerts ?? []);
  }

  async function ack(alertId: string) {
    setAlerts((cur) => (cur ? cur.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)) : cur));
    await fetch(`/api/projects/${slug}/alerts`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alertId, acknowledged: true }),
    });
    setAlerts((cur) => {
      const unack = (cur ?? []).filter((a) => !a.acknowledged).length;
      window.dispatchEvent(
        new CustomEvent('reputascan:alerts-changed', { detail: { slug, unacknowledgedAlerts: unack } }),
      );
      return cur;
    });
  }

  function toggleExpand(alertId: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(alertId)) next.delete(alertId);
      else next.add(alertId);
      return next;
    });
  }

  if (alerts === null) return <AlertsSkeleton />;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight mb-1 flex items-center gap-2"><Bell size={20}/> Alerts</h1>
      <p className="text-sm text-ink-400 mb-6">Notifikasi otomatis berdasarkan tren sentimen, toksisitas, dan kredibilitas media.</p>

      {alerts.length === 0 && <div className="card p-6 text-sm text-ink-400">Tidak ada alert aktif.</div>}

      <div className="space-y-3">
        {alerts.map((a) => {
          const samples = a.payload?.samples ?? [];
          const isOpen = expanded.has(a.id);
          const hasDetails = samples.length > 0;
          return (
            <div
              key={a.id}
              className={clsx(
                'card transition-all',
                a.severity === 'CRITICAL' && 'border-danger-500/50',
                a.severity === 'HIGH' && 'border-warning-500/40',
                a.acknowledged && 'opacity-60',
              )}
            >
              {/* Header row — clickable to expand */}
              <div
                className={clsx(
                  'p-4 flex items-start gap-3',
                  hasDetails && 'cursor-pointer hover:bg-ink-800/30',
                )}
                onClick={() => hasDetails && toggleExpand(a.id)}
              >
                <div className={clsx(
                  'mt-1.5 w-2.5 h-2.5 rounded-full shrink-0',
                  a.severity === 'CRITICAL' && 'bg-danger-500',
                  a.severity === 'HIGH' && 'bg-warning-500',
                  a.severity === 'MEDIUM' && 'bg-accent-500',
                  a.severity === 'LOW' && 'bg-ink-400',
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {hasDetails && (
                      <span className="text-ink-400">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    )}
                    <div className="font-medium text-ink-100">{a.title}</div>
                    <span className="chip">{a.type.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="chip">{a.severity}</span>
                  </div>
                  <div className="text-sm text-ink-300 mt-1">{a.message}</div>
                  <div className="text-xs text-ink-500 mt-1">{new Date(a.createdAt).toLocaleString('id-ID')}</div>
                </div>
                {!a.acknowledged && (
                  <button
                    onClick={(e) => { e.stopPropagation(); ack(a.id); }}
                    className="btn-ghost text-xs shrink-0"
                  >
                    <Check size={12}/> Ack
                  </button>
                )}
              </div>

              {/* Expanded detail — list of mentions */}
              {hasDetails && isOpen && (
                <div className="border-t border-ink-800 px-4 py-3 bg-ink-900/40">
                  <div className="text-[11px] uppercase tracking-wider text-ink-500 mb-2">
                    Berita yang memicu alert ini ({samples.length})
                  </div>
                  <div className="space-y-2">
                    {samples.map((s) => (
                      <a
                        key={s.id}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-ink-800/50 transition group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-ink-100 group-hover:text-accent-400 line-clamp-2">
                            {s.title}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-ink-400">
                            <span className="text-ink-300">{s.source}</span>
                            {s.publishedAt && (
                              <>
                                <span>·</span>
                                <span>{new Date(s.publishedAt).toLocaleDateString('id-ID', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })}</span>
                              </>
                            )}
                            {s.sentimentScore != null && (
                              <>
                                <span>·</span>
                                <span className={clsx(
                                  'tabular-nums',
                                  s.sentimentScore < -0.3 ? 'text-danger-500' :
                                  s.sentimentScore < 0 ? 'text-warning-500' : 'text-ink-400',
                                )}>
                                  sentiment {s.sentimentScore.toFixed(2)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <ExternalLink size={14} className="text-ink-500 group-hover:text-accent-400 mt-1 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
