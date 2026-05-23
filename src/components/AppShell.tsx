'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  FileText,
  FolderKanban,
  LogOut,
  Plus,
  Radar,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch, clearToken } from '@/lib/api-client';

interface Project {
  id: string;     // UUID — internal only
  slug: string;   // public identifier used in URLs and event matching
  name: string;
  unacknowledgedAlerts?: number;
}

interface User { id: string; email: string; name: string | null }

export default function AppShell({
  projectSlug: projectSlugProp,
  children,
}: {
  /** Optional override. Normally derived from pathname so the shell can sit in a layout. */
  projectSlug?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [open, setOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  // Derive slug from /projects/<slug>(/...)? — `[slug]` segment value.
  const derivedSlug = (() => {
    const m = pathname.match(/^\/projects\/([^/]+)/);
    if (!m) return undefined;
    if (m[1] === 'new') return undefined;
    return m[1];
  })();
  const projectSlug = projectSlugProp ?? derivedSlug;

  useEffect(() => {
    (async () => {
      const me = await apiFetch('/api/auth/me').then((r) => r.json()).catch(() => null);
      if (!me?.user) return router.push('/login');
      setUser(me.user);
      const p = await apiFetch('/api/projects').then((r) => r.json()).catch(() => ({ projects: [] }));
      setProjects(p.projects ?? []);
    })();
  }, [router]);

  // Listen for in-app events from other pages so the sidebar stays in sync
  // WITHOUT extra GET /api/projects round trips. All events use `slug` as the
  // identifier (matches what URLs and routes use).
  useEffect(() => {
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as { slug: string; name?: string; description?: string | null; active?: boolean };
      if (!detail?.slug) return;
      setProjects((cur) =>
        cur ? cur.map((p) => (p.slug === detail.slug ? { ...p, ...(detail.name !== undefined ? { name: detail.name } : {}) } : p)) : cur,
      );
    };
    const onDeleted = (e: Event) => {
      const detail = (e as CustomEvent).detail as { slug: string };
      if (!detail?.slug) return;
      setProjects((cur) => (cur ? cur.filter((p) => p.slug !== detail.slug) : cur));
    };
    const onAlertsChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail as { slug: string; unacknowledgedAlerts: number };
      if (!detail?.slug) return;
      setProjects((cur) =>
        cur ? cur.map((p) => (p.slug === detail.slug ? { ...p, unacknowledgedAlerts: detail.unacknowledgedAlerts } : p)) : cur,
      );
    };
    window.addEventListener('reputascan:project-updated', onUpdated);
    window.addEventListener('reputascan:project-deleted', onDeleted);
    window.addEventListener('reputascan:alerts-changed', onAlertsChanged);
    return () => {
      window.removeEventListener('reputascan:project-updated', onUpdated);
      window.removeEventListener('reputascan:project-deleted', onDeleted);
      window.removeEventListener('reputascan:alerts-changed', onAlertsChanged);
    };
  }, []);

  // Close dropdown on outside click / escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function logout() {
    // Best-effort server notification, but client-side token clear is what matters.
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearToken();
    router.push('/login');
  }

  const currentProject = projects?.find((p) => p.slug === projectSlug) ?? null;
  const currentUnack = currentProject?.unacknowledgedAlerts ?? 0;

  const nav = projectSlug
    ? [
        { href: `/projects/${projectSlug}`, label: 'Dashboard', icon: BarChart3, badge: 0 },
        { href: `/projects/${projectSlug}/mentions`, label: 'Mentions', icon: Search, badge: 0 },
        { href: `/projects/${projectSlug}/alerts`, label: 'Alerts', icon: Bell, badge: currentUnack },
        { href: `/projects/${projectSlug}/insight`, label: 'Insight', icon: Sparkles, badge: 0 },
        { href: `/projects/${projectSlug}/report`, label: 'Report', icon: FileText, badge: 0 },
        { href: `/projects/${projectSlug}/crawl`, label: 'Crawl Logs', icon: Activity, badge: 0 },
        { href: `/projects/${projectSlug}/settings`, label: 'Settings', icon: Settings, badge: 0 },
      ]
    : [];

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-ink-800 bg-ink-900/50 backdrop-blur p-4 flex flex-col">
        <Link href="/projects" className="flex items-center gap-2 mb-8">
          <div className="grid place-items-center w-9 h-9 rounded-lg bg-accent-500/15 border border-accent-500/30 text-accent-400">
            <Radar size={18} />
          </div>
          <div>
            <div className="font-semibold tracking-tight">ReputaScan ID</div>
            <div className="text-[11px] text-ink-400 uppercase tracking-wider">Media Intelligence</div>
          </div>
        </Link>

        {/* Project dropdown */}
        <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-2">Project</div>
        <div ref={ddRef} className="relative mb-6">
          {projects === null ? (
            <div className="h-9 rounded-lg bg-ink-700/40 animate-pulse" />
          ) : (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={clsx(
                  'w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition',
                  open ? 'border-accent-500/40 bg-ink-800/80' : 'border-ink-700 bg-ink-900/60 hover:border-ink-600 hover:bg-ink-800/60',
                )}
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <FolderKanban size={14} className="text-accent-400 shrink-0" />
                  <span className="truncate text-left">
                    {currentProject ? currentProject.name : projects.length === 0 ? 'Belum ada project' : 'Pilih project'}
                  </span>
                </span>
                <ChevronDown
                  size={14}
                  className={clsx('text-ink-400 shrink-0 transition-transform', open && 'rotate-180')}
                />
              </button>

              {open && (
                <div className="absolute left-0 right-0 top-full mt-2 z-30 rounded-lg border border-ink-700 bg-ink-900/95 backdrop-blur shadow-xl overflow-hidden">
                  <div className="max-h-72 overflow-auto scrollbar py-1">
                    {projects.length === 0 ? (
                      <div className="text-xs text-ink-500 px-3 py-3 italic">Belum ada project.</div>
                    ) : (
                      projects.map((p) => {
                        const active = p.slug === projectSlug;
                        const unack = p.unacknowledgedAlerts ?? 0;
                        return (
                          <Link
                            key={p.id}
                            href={`/projects/${p.slug}`}
                            onClick={() => setOpen(false)}
                            className={clsx(
                              'flex items-center justify-between gap-2 px-3 py-2 text-sm truncate',
                              active ? 'bg-accent-500/10 text-accent-400' : 'text-ink-200 hover:bg-ink-800',
                            )}
                          >
                            <span className="truncate flex items-center gap-2">
                              {unack > 0 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0" title={`${unack} alert belum dikonfirmasi`} />
                              )}
                              {p.name}
                            </span>
                            {active && <span className="w-1.5 h-1.5 rounded-full bg-accent-400 shrink-0" />}
                          </Link>
                        );
                      })
                    )}
                  </div>
                  <Link
                    href="/projects/new"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-accent-400 border-t border-ink-800 hover:bg-ink-800"
                  >
                    <Plus size={12} /> New project
                  </Link>
                  <Link
                    href="/projects"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 text-xs text-ink-400 border-t border-ink-800 hover:bg-ink-800"
                  >
                    Lihat semua project →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {nav.length > 0 && (
          <>
            <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-2">Workspace</div>
            <nav className="space-y-1 flex-1">
              {nav.map((n) => {
                const Icon = n.icon;
                const active = pathname === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={clsx(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm relative',
                      active ? 'bg-accent-500/15 text-accent-400' : 'text-ink-200 hover:bg-ink-800/80',
                    )}
                  >
                    <Icon size={16} />
                    <span className="flex-1">{n.label}</span>
                    {n.badge > 0 && (
                      <span
                        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-danger-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                        title={`${n.badge} belum dikonfirmasi`}
                      >
                        {n.badge > 9 ? '9+' : n.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </>
        )}

        <div className="mt-auto pt-4 border-t border-ink-800">
          {user ? (
            <div className="text-xs text-ink-300 truncate">{user.email}</div>
          ) : (
            <div className="h-3 w-32 bg-ink-700/60 rounded animate-pulse" />
          )}
          <button onClick={logout} className="mt-2 flex items-center gap-1 text-xs text-ink-400 hover:text-danger-500">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
