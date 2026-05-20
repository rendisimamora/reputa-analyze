'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

export default function NewProject() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<'ANY' | 'ALL'>('ANY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addKeyword() {
    const k = keywordInput.trim();
    if (!k) return;
    if (keywords.includes(k)) return;
    setKeywords([...keywords, k]);
    setKeywordInput('');
  }

  function removeKeyword(k: string) {
    setKeywords(keywords.filter((x) => x !== k));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!keywords.length) { setError('Tambahkan minimal 1 keyword'); return; }
    setLoading(true);
    setError(null);
    const r = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description, keywords, matchMode }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? 'Gagal membuat project');
      setLoading(false);
      return;
    }
    const { project } = await r.json();
    // Trigger first scan in background; user can navigate immediately
    fetch(`/api/projects/${project.slug}/scan`, { method: 'POST' }).catch(() => {});
    router.push(`/projects/${project.slug}`);
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">New monitoring project</h1>
      <p className="text-sm text-ink-400 mb-6">Setelah dibuat, sistem akan mulai mengambil data nyata dari RSS dan halaman publik media Indonesia.</p>

      <form onSubmit={submit} className="card p-6 max-w-2xl space-y-4">
        <div>
          <label className="label">Nama project</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Brand X Q2 2026" />
        </div>
        <div>
          <label className="label">Deskripsi (opsional)</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label className="label">Keywords (subjek monitoring)</label>
          <div className="flex gap-2">
            <input
              className="input"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
              placeholder="cth: PDIP, Prabowo, Telkomsel, gojek"
            />
            <button type="button" className="btn-ghost" onClick={addKeyword}>Add</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {keywords.map((k) => (
              <span key={k} className="chip">
                {k}
                <button type="button" onClick={() => removeKeyword(k)} className="text-ink-400 hover:text-danger-500">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 text-xs text-ink-400 leading-relaxed">
            💡 Gunakan keyword <strong>pendek &amp; umum</strong> (1-3 kata) yang biasa muncul di artikel berita. Tambahkan beberapa varian penulisan supaya cakupan lebih luas.
            <br/>
            Contoh untuk monitoring PDIP: <code className="text-accent-400">PDIP</code>, <code className="text-accent-400">PDI Perjuangan</code>, <code className="text-accent-400">Megawati</code>.
            <br/>
            Hindari frasa panjang seperti &quot;Partai PDIP Perjuangan&quot; karena tidak pernah ditulis utuh di berita.
          </div>
        </div>

        <div>
          <label className="label">Match mode</label>
          <select className="input" value={matchMode} onChange={(e) => setMatchMode(e.target.value as 'ANY' | 'ALL')}>
            <option value="ANY">ANY — minimal 1 keyword match</option>
            <option value="ALL">ALL — semua keyword harus match</option>
          </select>
        </div>

        {error && <div className="text-sm text-danger-500">{error}</div>}

        <div className="pt-2 flex justify-end">
          <button className="btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create project & scan'}</button>
        </div>
      </form>
    </>
  );
}
