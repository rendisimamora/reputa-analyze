'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Power, Save, Settings as SettingsIcon, Trash2, X } from 'lucide-react';
import { clsx } from 'clsx';

interface Keyword { id: string; term: string; matchMode: 'ANY' | 'ALL' }
interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  active: boolean;
  lastScanAt: string | null;
  createdAt: string;
  keywords: Keyword[];
}

export default function ProjectSettings({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<'ANY' | 'ALL'>('ANY');
  const [kwInput, setKwInput] = useState('');

  const [savingProject, setSavingProject] = useState(false);
  const [savingKeywords, setSavingKeywords] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const r = await fetch(`/api/projects/${slug}`);
    if (!r.ok) { setError('Project tidak ditemukan'); return; }
    const { project: p } = (await r.json()) as { project: Project };
    setProject(p);
    setName(p.name);
    setDescription(p.description ?? '');
    setActive(p.active);
    setKeywords(p.keywords.map((k) => k.term));
    setMatchMode((p.keywords[0]?.matchMode as 'ANY' | 'ALL') ?? 'ANY');
  }

  function addKeyword() {
    const k = kwInput.trim();
    if (!k || keywords.includes(k)) { setKwInput(''); return; }
    setKeywords([...keywords, k]);
    setKwInput('');
  }
  function removeKeyword(k: string) {
    setKeywords(keywords.filter((x) => x !== k));
  }

  async function saveProject() {
    setSavingProject(true);
    setError(null);
    setSavedMsg(null);
    try {
      const r = await fetch(`/api/projects/${slug}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, description: description || null, active }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? 'Gagal menyimpan project');
        return;
      }
      const { project: updated } = (await r.json()) as { project: Project };
      // Update local state from response (no second GET) — saves a round trip.
      setProject(updated);
      // Broadcast so AppShell can update the sidebar dropdown without a DB hit.
      window.dispatchEvent(
        new CustomEvent('reputascan:project-updated', {
          detail: {
            slug: updated.slug,
            name: updated.name,
            description: updated.description,
            active: updated.active,
          },
        }),
      );
      setSavedMsg('Project info tersimpan.');
    } finally {
      setSavingProject(false);
    }
  }

  async function saveKeywords() {
    if (keywords.length === 0) {
      setError('Minimal 1 keyword');
      return;
    }
    setSavingKeywords(true);
    setError(null);
    setSavedMsg(null);
    try {
      const r = await fetch(`/api/projects/${slug}/keywords`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keywords, matchMode }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? 'Gagal menyimpan keywords');
        return;
      }
      setSavedMsg('Keywords tersimpan. Jalankan scan ulang untuk apply.');
      await load();
    } finally {
      setSavingKeywords(false);
    }
  }

  async function deleteProject() {
    setDeleting(true);
    try {
      const r = await fetch(`/api/projects/${slug}`, { method: 'DELETE' });
      if (r.ok) {
        // Sync sidebar immediately, no extra fetch.
        window.dispatchEvent(new CustomEvent('reputascan:project-deleted', { detail: { slug } }));
        router.push('/projects');
      } else {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? 'Gagal menghapus project');
        setDeleting(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus project');
      setDeleting(false);
    }
  }

  if (!project && !error) {
    return (
      <>
        <div className="h-7 w-44 bg-ink-700/60 rounded animate-pulse mb-2" />
        <div className="h-3 w-64 bg-ink-700/40 rounded animate-pulse mb-6" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-5 mb-4 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="h-4 w-32 bg-ink-700/60 rounded mb-3" />
            <div className="h-9 w-full bg-ink-700/40 rounded" />
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight mb-1 flex items-center gap-2"><SettingsIcon size={20}/> Project Settings</h1>
      <p className="text-sm text-ink-400 mb-6">Ubah info project, keywords, status aktif/non-aktif, atau hapus project ini.</p>

      {error && <div className="card border-danger-500/40 bg-danger-500/5 text-sm text-danger-500 p-3 mb-4">{error}</div>}
      {savedMsg && (
        <div className="card border-success-500/40 bg-success-500/5 text-sm text-success-500 p-3 mb-4 flex items-center gap-2">
          <CheckCircle2 size={14}/> {savedMsg}
        </div>
      )}

      {/* General info */}
      <div className="card p-5 mb-4 max-w-2xl">
        <div className="text-sm font-medium mb-1">General</div>
        <div className="text-xs text-ink-400 mb-4">Nama, deskripsi, dan status aktif scheduler.</div>

        <div className="space-y-4">
          <div>
            <label className="label">Nama project</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Deskripsi (opsional)</label>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Status</label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="mt-1 accent-accent-500"
              />
              <div>
                <div className="text-sm text-ink-100 flex items-center gap-2">
                  <Power size={12} className={active ? 'text-success-500' : 'text-ink-400'}/>
                  Active (di-scan otomatis oleh scheduler)
                </div>
                <div className="text-xs text-ink-400">Matikan kalau ingin pause scheduler tanpa hapus data historis.</div>
              </div>
            </label>
          </div>

          <div className="flex justify-end">
            <button onClick={saveProject} className="btn-primary" disabled={savingProject}>
              {savingProject ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
              {savingProject ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>

      {/* Keywords */}
      <div className="card p-5 mb-4 max-w-2xl">
        <div className="text-sm font-medium mb-1">Keywords</div>
        <div className="text-xs text-ink-400 mb-4">
          Subjek monitoring. Gunakan kata pendek &amp; umum (1-3 kata) untuk hasil terbaik.
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Add keyword</label>
            <div className="flex gap-2">
              <input
                className="input"
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                placeholder="cth: PDIP, Prabowo, Gojek"
              />
              <button type="button" className="btn-ghost" onClick={addKeyword}>Add</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[32px]">
            {keywords.length === 0 ? (
              <span className="text-xs text-ink-500 italic">Belum ada keyword.</span>
            ) : keywords.map((k) => (
              <span key={k} className="chip">
                {k}
                <button type="button" onClick={() => removeKeyword(k)} className="text-ink-400 hover:text-danger-500">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          <div>
            <label className="label">Match mode</label>
            <select className="input" value={matchMode} onChange={(e) => setMatchMode(e.target.value as 'ANY' | 'ALL')}>
              <option value="ANY">ANY — minimal 1 keyword match</option>
              <option value="ALL">ALL — semua keyword harus match</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button onClick={saveKeywords} className="btn-primary" disabled={savingKeywords || keywords.length === 0}>
              {savingKeywords ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
              {savingKeywords ? 'Menyimpan…' : 'Simpan keywords'}
            </button>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card border-danger-500/30 bg-danger-500/5 p-5 max-w-2xl">
        <div className="text-sm font-medium text-danger-500 mb-1">Danger zone</div>
        <div className="text-xs text-ink-400 mb-4">
          Hapus project ini permanen. Semua mention, alert, dan report ikut terhapus dan tidak bisa dikembalikan.
        </div>

        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="btn-danger">
            <Trash2 size={14}/> Hapus project
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-danger-500">Yakin hapus &quot;{project?.name}&quot;?</span>
            <button onClick={deleteProject} className="btn-danger" disabled={deleting}>
              {deleting ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
              {deleting ? 'Menghapus…' : 'Ya, hapus'}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost" disabled={deleting}>
              Batal
            </button>
          </div>
        )}
      </div>

      <div className={clsx(
        'mt-6 text-xs text-ink-500 max-w-2xl',
        !project && 'invisible',
      )}>
        Dibuat {project && new Date(project.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        {project?.lastScanAt && (
          <> · Last scan {new Date(project.lastScanAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
        )}
      </div>
    </>
  );
}
