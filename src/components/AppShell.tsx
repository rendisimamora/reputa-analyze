'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, BarChart3, Bell, FileText, LogOut, Radar, Search } from 'lucide-react';
import { clsx } from 'clsx';

interface Project { id: string; name: string }
interface User { id: string; email: string; name: string | null }

export default function AppShell({
  projectId,
  children,
}: {
  projectId?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/auth/me').then((r) => r.json()).catch(() => null);
      if (!me?.user) return router.push('/login');
      setUser(me.user);
      const p = await fetch('/api/projects').then((r) => r.json()).catch(() => ({ projects: [] }));
      setProjects(p.projects ?? []);
    })();
  }, [router]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const nav = projectId
    ? [
        { href: `/projects/${projectId}`, label: 'Dashboard', icon: BarChart3 },
        { href: `/projects/${projectId}/mentions`, label: 'Mentions', icon: Search },
        { href: `/projects/${projectId}/alerts`, label: 'Alerts', icon: Bell },
        { href: `/projects/${projectId}/report`, label: 'Report', icon: FileText },
        { href: `/projects/${projectId}/crawl`, label: 'Crawl Logs', icon: Activity },
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

        <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-2">Projects</div>
        <nav className="space-y-1 mb-6 max-h-56 overflow-auto scrollbar">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className={clsx(
                'block text-sm rounded-md px-2 py-1.5 truncate',
                p.id === projectId ? 'bg-accent-500/10 text-accent-400 border border-accent-500/20' : 'hover:bg-ink-800/80 text-ink-200',
              )}
            >
              {p.name}
            </Link>
          ))}
          <Link href="/projects/new" className="block text-xs text-accent-400 mt-2 hover:underline">+ New project</Link>
        </nav>

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
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                      active ? 'bg-accent-500/15 text-accent-400' : 'text-ink-200 hover:bg-ink-800/80',
                    )}
                  >
                    <Icon size={16} />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}

        <div className="mt-auto pt-4 border-t border-ink-800">
          <div className="text-xs text-ink-300 truncate">{user?.email}</div>
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
