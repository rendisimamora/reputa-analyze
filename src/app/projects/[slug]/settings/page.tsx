'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Power, Save, Send, Settings as SettingsIcon, Trash2, X, AlertTriangle } from 'lucide-react';
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
  telegramEnabled?: boolean;
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  telegramLastSentAt?: string | null;
  telegramLastError?: string | null;
}

export default function ProjectSettings({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);

  // Telegram bot config — per project
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState<{ ok: boolean; text: string } | null>(null);
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
    setTelegramEnabled(!!p.telegramEnabled);
    setTelegramBotToken(p.telegramBotToken ?? '');
    setTelegramChatId(p.telegramChatId ?? '');
  }

  async function saveTelegram() {
    setSavingTelegram(true);
    setTelegramMsg(null);
    try {
      const r = await fetch(`/api/projects/${slug}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          telegramEnabled,
          telegramBotToken: telegramBotToken.trim() || null,
          telegramChatId: telegramChatId.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setTelegramMsg({ ok: false, text: j.error ?? 'Gagal menyimpan' });
        return;
      }
      setTelegramMsg({ ok: true, text: 'Tersimpan.' });
      // Refresh project + input state from server so the UI reflects what's actually
      // persisted (especially relevant for the password-masked token field).
      if (j.project) {
        const p = j.project as Project;
        setProject(p);
        setTelegramEnabled(!!p.telegramEnabled);
        setTelegramBotToken(p.telegramBotToken ?? '');
        setTelegramChatId(p.telegramChatId ?? '');
      }
    } finally {
      setSavingTelegram(false);
    }
  }

  async function testTelegram() {
    setTestingTelegram(true);
    setTelegramMsg(null);
    try {
      const r = await fetch(`/api/projects/${slug}/telegram-test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramBotToken.trim() || undefined,
          chatId: telegramChatId.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setTelegramMsg({ ok: false, text: j.error ?? `Test gagal (${r.status})` });
        return;
      }
      setTelegramMsg({ ok: true, text: 'Test message terkirim! Cek Telegram kamu.' });
    } catch (e) {
      setTelegramMsg({ ok: false, text: e instanceof Error ? e.message : 'Test gagal' });
    } finally {
      setTestingTelegram(false);
    }
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

      {/* Telegram Notifications */}
      <div className="card p-5 mb-4 max-w-2xl">
        <div className="text-sm font-medium mb-1 flex items-center gap-2">
          <Send size={14} className="text-accent-400" />
          Telegram Notifications
        </div>
        <div className="text-xs text-ink-400 mb-4">
          Push setiap alert otomatis ke chat Telegram lewat bot. Bikin bot via{' '}
          <a href="https://t.me/BotFather" target="_blank" rel="noreferrer noopener" className="text-accent-400 hover:underline">
            @BotFather
          </a>{' '}
          → dapet token. Chat ID bisa dicek pakai{' '}
          <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer noopener" className="text-accent-400 hover:underline">
            @userinfobot
          </a>{' '}
          (kirim /start, balasan = chat ID).
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md bg-ink-900/40 border border-ink-800">
            <div>
              <div className="text-sm text-ink-100">Aktifkan notifikasi</div>
              <div className="text-xs text-ink-400 mt-0.5">
                Saat ON, semua alert baru dikirim ke chat di bawah.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTelegramEnabled((v) => !v)}
              className={clsx(
                'relative w-11 h-6 rounded-full transition',
                telegramEnabled ? 'bg-accent-500' : 'bg-ink-700',
              )}
            >
              <div className={clsx(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all',
                telegramEnabled ? 'left-[22px]' : 'left-0.5',
              )} />
            </button>
          </div>

          <div>
            <label className="label">Bot Token</label>
            <input
              type="password"
              className="input font-mono text-xs"
              placeholder="1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
            />
            <div className="text-xs text-ink-500 mt-1 flex items-center justify-between gap-2">
              <span>Disimpan terenkripsi-at-rest oleh database.</span>
              {project?.telegramBotToken && !telegramBotToken.trim() && (
                <span className="text-success-500 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Token tersimpan
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="label">Chat ID</label>
            <input
              type="text"
              className="input font-mono text-xs"
              placeholder="cth: 123456789 atau -1001234567890 untuk group"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
            />
          </div>

          {telegramMsg && (
            <div className={clsx(
              'flex items-start gap-2 text-xs p-2.5 rounded-md',
              telegramMsg.ok
                ? 'bg-success-500/5 text-success-500 border border-success-500/20'
                : 'bg-danger-500/5 text-danger-500 border border-danger-500/20',
            )}>
              {telegramMsg.ok ? <CheckCircle2 size={14} className="mt-0.5" /> : <AlertTriangle size={14} className="mt-0.5" />}
              <span>{telegramMsg.text}</span>
            </div>
          )}

          {project?.telegramLastSentAt && !telegramMsg && (
            <div className="text-xs text-ink-500">
              Terakhir terkirim: {new Date(project.telegramLastSentAt).toLocaleString('id-ID')}
              {project.telegramLastError && (
                <div className="text-warning-500 mt-1 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="mt-0.5" />
                  Error terakhir: {project.telegramLastError.slice(0, 200)}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={testTelegram}
              disabled={testingTelegram || (
                (!telegramBotToken.trim() && !project?.telegramBotToken) ||
                (!telegramChatId.trim() && !project?.telegramChatId)
              )}
              className="btn-ghost"
            >
              {testingTelegram ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {testingTelegram ? 'Mengirim test…' : 'Test message'}
            </button>
            <button onClick={saveTelegram} className="btn-primary" disabled={savingTelegram}>
              {savingTelegram ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {savingTelegram ? 'Menyimpan…' : 'Simpan'}
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
