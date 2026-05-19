'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { ArrowRight, Radar } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  lastScanAt: string | null;
  _count: { mentions: number; alerts: number };
  keywords: Array<{ term: string }>;
}

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  useEffect(() => {
    fetch('/api/projects').then((r) => r.json()).then((d) => setProjects(d.projects ?? []));
  }, []);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitoring Projects</h1>
          <p className="text-sm text-ink-400">All your active reputation tracking workspaces.</p>
        </div>
        <Link href="/projects/new" className="btn-primary"><Radar size={16}/> New project</Link>
      </div>

      {projects === null ? (
        <div className="text-sm text-ink-400">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-lg font-medium mb-1">No projects yet</div>
          <div className="text-sm text-ink-400 mb-4">Create your first monitoring project to start collecting real mentions from Indonesian media.</div>
          <Link href="/projects/new" className="btn-primary inline-flex">+ Create project</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card hover:border-accent-500/40 transition p-5 group">
              <div className="flex items-start justify-between">
                <div className="font-medium">{p.name}</div>
                <ArrowRight size={16} className="text-ink-500 group-hover:text-accent-400" />
              </div>
              {p.description && <div className="mt-1 text-xs text-ink-400 line-clamp-2">{p.description}</div>}
              <div className="mt-3 flex flex-wrap gap-1">
                {p.keywords.slice(0, 5).map((k) => (
                  <span key={k.term} className="chip">{k.term}</span>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 text-center text-xs text-ink-300">
                <div><div className="text-base font-semibold text-ink-100">{p._count.mentions}</div>mentions</div>
                <div><div className="text-base font-semibold text-ink-100">{p._count.alerts}</div>alerts</div>
                <div><div className="text-base font-semibold text-ink-100">{p.lastScanAt ? new Date(p.lastScanAt).toLocaleDateString() : '—'}</div>last scan</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
