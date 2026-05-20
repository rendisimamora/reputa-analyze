'use client';

import { use, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Bell, Check } from 'lucide-react';
import { AlertsSkeleton } from '@/components/PageSkeletons';

interface Alert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

export default function AlertsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  async function load() {
    const r = await fetch(`/api/projects/${id}/alerts`);
    const j = await r.json();
    setAlerts(j.alerts ?? []);
  }

  async function ack(alertId: string) {
    // Optimistic UI update — flip locally first
    setAlerts((cur) => (cur ? cur.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)) : cur));
    await fetch(`/api/projects/${id}/alerts`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alertId, acknowledged: true }),
    });
    // Notify sidebar so the badge count drops without re-fetching /api/projects
    setAlerts((cur) => {
      const unack = (cur ?? []).filter((a) => !a.acknowledged).length;
      window.dispatchEvent(
        new CustomEvent('reputascan:alerts-changed', { detail: { id, unacknowledgedAlerts: unack } }),
      );
      return cur;
    });
  }

  if (alerts === null) return <AlertsSkeleton />;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight mb-1 flex items-center gap-2"><Bell size={20}/> Alerts</h1>
      <p className="text-sm text-ink-400 mb-6">Notifikasi otomatis berdasarkan tren sentimen, toksisitas, dan kredibilitas media.</p>

      {alerts.length === 0 && <div className="card p-6 text-sm text-ink-400">Tidak ada alert aktif.</div>}

      <div className="space-y-3">
        {alerts.map((a) => (
          <div key={a.id} className={clsx(
            'card p-4 flex items-start gap-3',
            a.severity === 'CRITICAL' && 'border-danger-500/50',
            a.severity === 'HIGH' && 'border-warning-500/40',
            a.acknowledged && 'opacity-60',
          )}>
            <div className={clsx(
              'mt-0.5 w-2.5 h-2.5 rounded-full',
              a.severity === 'CRITICAL' && 'bg-danger-500',
              a.severity === 'HIGH' && 'bg-warning-500',
              a.severity === 'MEDIUM' && 'bg-accent-500',
              a.severity === 'LOW' && 'bg-ink-400',
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium text-ink-100">{a.title}</div>
                <span className="chip">{a.type.replace('_', ' ').toLowerCase()}</span>
                <span className="chip">{a.severity}</span>
              </div>
              <div className="text-sm text-ink-300 mt-1">{a.message}</div>
              <div className="text-xs text-ink-500 mt-1">{new Date(a.createdAt).toLocaleString('id-ID')}</div>
            </div>
            {!a.acknowledged && (
              <button onClick={() => ack(a.id)} className="btn-ghost text-xs"><Check size={12}/> Ack</button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
