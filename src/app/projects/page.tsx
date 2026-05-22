'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Radar, Trash2 } from 'lucide-react';

interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  lastScanAt: string | null;
  _count: { mentions: number; alerts: number };
  keywords: Array<{ term: string }>;
  unacknowledgedAlerts: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/projects');
    const j = await r.json();
    setProjects(j.projects ?? []);
  }, []);

  // StrictMode guard — projects list fetched once on mount.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deleteProject(slug: string) {
    setDeletingId(slug);
    setError(null);
    try {
      const r = await fetch(`/api/projects/${slug}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? 'Gagal menghapus project');
        return;
      }
      setProjects((cur) => (cur ? cur.filter((p) => p.slug !== slug) : cur));
      setConfirmId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus project');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitoring Projects</h1>
          <p className="text-sm text-ink-400">All your active reputation tracking workspaces.</p>
        </div>
        <Link href="/projects/new" className="btn-primary"><Radar size={16}/> New project</Link>
      </div>

      {error && <div className="card border-danger-500/40 bg-danger-500/5 text-sm text-danger-500 p-3 mb-4">{error}</div>}

      {projects === null ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-start justify-between">
                <div className="h-4 w-40 bg-ink-700/60 rounded" />
                <div className="h-4 w-4 bg-ink-700/60 rounded" />
              </div>
              <div className="mt-3 flex gap-1">
                <div className="h-5 w-16 bg-ink-700/40 rounded-full" />
                <div className="h-5 w-20 bg-ink-700/40 rounded-full" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="space-y-1.5 text-center">
                    <div className="h-5 w-8 mx-auto bg-ink-700/60 rounded" />
                    <div className="h-3 w-12 mx-auto bg-ink-700/40 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-lg font-medium mb-1">No projects yet</div>
          <div className="text-sm text-ink-400 mb-4">Create your first monitoring project to start collecting real mentions from Indonesian media.</div>
          <Link href="/projects/new" className="btn-primary inline-flex">+ Create project</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => {
            const isDeleting = deletingId === p.slug;
            const askConfirm = confirmId === p.slug;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.slug}`}
                className="card hover:border-accent-500/40 transition p-5 group block relative"
              >
                {/* Unacknowledged alerts indicator — pulsing red dot at top-left of card */}
                {p.unacknowledgedAlerts > 0 && (
                  <span
                    className="absolute -top-1.5 -left-1.5 flex h-3 w-3"
                    title={`${p.unacknowledgedAlerts} alert belum dikonfirmasi`}
                  >
                    <span className="absolute inline-flex h-full w-full rounded-full bg-danger-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-danger-500 ring-2 ring-ink-900" />
                  </span>
                )}

                <div className="flex items-start justify-between">
                  <div className="font-medium">{p.name}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isDeleting && !askConfirm && (
                      <button
                        type="button"
                        title="Hapus project"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmId(p.slug); }}
                        className="opacity-0 group-hover:opacity-100 transition text-ink-400 hover:text-danger-500 p-1 rounded hover:bg-ink-800/80"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {isDeleting && <Loader2 size={14} className="animate-spin text-danger-500" />}
                    <ArrowRight size={16} className="text-ink-500 group-hover:text-accent-400" />
                  </div>
                </div>

                {p.description && <div className="mt-1 text-xs text-ink-400 line-clamp-2">{p.description}</div>}

                <div className="mt-3 flex flex-wrap gap-1">
                  {p.keywords.slice(0, 5).map((k) => (
                    <span key={k.term} className="chip">{k.term}</span>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 text-center text-xs text-ink-300">
                  <div>
                    <div className="text-base font-semibold text-ink-100">{p._count.mentions}</div>
                    mentions
                  </div>
                  <div>
                    <div
                      className={`text-base font-semibold ${p.unacknowledgedAlerts > 0 ? 'text-danger-500' : 'text-ink-100'}`}
                      title={p.unacknowledgedAlerts > 0 ? `${p.unacknowledgedAlerts} belum dikonfirmasi` : undefined}
                    >
                      {p._count.alerts}
                    </div>
                    <div>alerts</div>
                  </div>
                  <div>
                    <div className="text-base font-semibold text-ink-100">{formatDate(p.lastScanAt)}</div>
                    last scan
                  </div>
                </div>

                {/* Confirm overlay */}
                {askConfirm && !isDeleting && (
                  <div
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm rounded-xl grid place-items-center px-5"
                  >
                    <div className="text-center">
                      <div className="text-sm font-medium text-ink-100">Hapus "{p.name}"?</div>
                      <div className="text-xs text-ink-400 mt-1 mb-4">Semua mention, alert, dan report ikut terhapus.</div>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmId(null); }}
                          className="text-xs px-3 py-1.5 rounded-md border border-ink-700 text-ink-200 hover:bg-ink-800"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteProject(p.slug); }}
                          className="text-xs px-3 py-1.5 rounded-md bg-danger-500/90 hover:bg-danger-500 text-white inline-flex items-center gap-1"
                        >
                          <Trash2 size={12}/> Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Deleting overlay */}
                {isDeleting && (
                  <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm rounded-xl grid place-items-center pointer-events-none">
                    <div className="flex items-center gap-2 text-sm text-danger-500">
                      <Loader2 size={16} className="animate-spin" /> Menghapus project…
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
