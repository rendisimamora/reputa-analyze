'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { Lightbulb, RefreshCw, Sparkles, Tag, AlertTriangle, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

// ─────────────────────────────────────────────────────────────────────────────
// Shape mirrors src/services/insight{Content,Keyword}.ts. Kept inline so the
// page can render without pulling server-only modules into the client bundle.
// ─────────────────────────────────────────────────────────────────────────────
interface ContentIdea {
  title: string;
  concept: string;
  influencerType: string;
  issueCounter: string;
  tone: 'informational' | 'emotional' | 'data-driven' | 'human-interest';
}

interface KeywordSuggestion {
  keyword: string;
  rationale: string;
  estimatedFit: 'high' | 'medium' | 'low';
  category: 'alias' | 'topic' | 'critic' | 'ally' | 'context';
}

interface CachedContent { ideas: ContentIdea[]; generatedAt: string; error?: string | null }
interface CachedKeyword { suggestions: KeywordSuggestion[]; generatedAt: string; error?: string | null }
interface InsightPayload { content: CachedContent | null; keyword: CachedKeyword | null }

type View = 'content' | 'keyword';

const VIEWS: Array<{ id: View; label: string; icon: typeof Lightbulb; description: string }> = [
  {
    id: 'content',
    label: 'Insight Content',
    icon: Lightbulb,
    description: 'Ide konten untuk counter berita negatif — siap dibagikan ke influencer / KOL.',
  },
  {
    id: 'keyword',
    label: 'Insight Keyword',
    icon: Tag,
    description: 'Rekomendasi keyword baru berdasarkan hasil scan terbaru.',
  },
];

const TONE_STYLES: Record<ContentIdea['tone'], string> = {
  'informational': 'bg-accent-500/10 text-accent-400 border-accent-500/30',
  'emotional': 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  'data-driven': 'bg-success-500/10 text-success-500 border-success-500/30',
  'human-interest': 'bg-warning-500/10 text-warning-500 border-warning-500/30',
};

const FIT_STYLES: Record<KeywordSuggestion['estimatedFit'], string> = {
  high: 'bg-success-500/10 text-success-500 border-success-500/30',
  medium: 'bg-accent-500/10 text-accent-400 border-accent-500/30',
  low: 'bg-ink-500/10 text-ink-400 border-ink-500/30',
};

const CAT_LABEL: Record<KeywordSuggestion['category'], string> = {
  alias: 'Alias / Varian',
  topic: 'Topik',
  critic: 'Kritikus',
  ally: 'Pendukung',
  context: 'Konteks',
};

export default function InsightPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [view, setView] = useState<View>('content');
  const [data, setData] = useState<InsightPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [regen, setRegen] = useState<View | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/projects/${slug}/insight`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `Gagal memuat insight (${r.status})`);
        return;
      }
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat insight');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  async function regenerate(type: View | 'all') {
    setRegen(type);
    setError(null);
    try {
      const r = await fetch(`/api/projects/${slug}/insight`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? 'Regenerate gagal');
        return;
      }
      // Merge — POST may return only the regenerated half
      setData((cur) => ({
        content: j.content ?? cur?.content ?? null,
        keyword: j.keyword ?? cur?.keyword ?? null,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regenerate gagal');
    } finally {
      setRegen(null);
    }
  }

  const current = VIEWS.find((v) => v.id === view)!;
  const ActiveIcon = current.icon;
  const generatedAt = useMemo(() => {
    const t = view === 'content' ? data?.content?.generatedAt : data?.keyword?.generatedAt;
    if (!t) return null;
    const d = new Date(t);
    if (d.getTime() === 0) return null;
    return d.toLocaleString('id-ID');
  }, [view, data]);

  const lastError = view === 'content' ? data?.content?.error : data?.keyword?.error;

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles size={20} className="text-accent-400" /> AI Insight
          </h1>
          <p className="text-sm text-ink-400 mt-1">{current.description}</p>
        </div>
        <button
          onClick={() => regenerate(view)}
          disabled={regen !== null}
          className="btn-primary"
        >
          {regen === view ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Regenerate
        </button>
      </div>

      {/* View dropdown */}
      <div className="relative mb-6 w-full max-w-md">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            'w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm transition',
            open ? 'border-accent-500/40 bg-ink-800/80' : 'border-ink-700 bg-ink-900/60 hover:border-ink-600',
          )}
        >
          <span className="flex items-center gap-2">
            <ActiveIcon size={16} className="text-accent-400" />
            <span className="font-medium">{current.label}</span>
          </span>
          <ChevronDown size={14} className={clsx('text-ink-400 transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-lg border border-ink-700 bg-ink-900/95 backdrop-blur shadow-xl overflow-hidden">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const active = v.id === view;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setView(v.id); setOpen(false); }}
                  className={clsx(
                    'w-full text-left px-3 py-2.5 flex items-start gap-2 transition',
                    active ? 'bg-accent-500/10 text-accent-300' : 'hover:bg-ink-800/60',
                  )}
                >
                  <Icon size={16} className={active ? 'text-accent-400 mt-0.5' : 'text-ink-300 mt-0.5'} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{v.label}</div>
                    <div className="text-xs text-ink-400 mt-0.5">{v.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Generated-at + error banners */}
      <div className="flex items-center justify-between text-xs text-ink-400 mb-4">
        <div>{generatedAt ? <>Last generated: <span className="text-ink-200">{generatedAt}</span></> : 'Belum pernah di-generate'}</div>
        {lastError && (
          <div className="flex items-center gap-1.5 text-warning-500">
            <AlertTriangle size={12} /> {lastError.slice(0, 120)}
          </div>
        )}
      </div>

      {error && (
        <div className="card border-danger-500/40 bg-danger-500/5 text-sm text-danger-500 p-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 h-40 animate-pulse bg-ink-900/40" />
          ))}
        </div>
      ) : view === 'content' ? (
        <ContentList ideas={data?.content?.ideas ?? []} regenerating={regen === 'content'} />
      ) : (
        <KeywordList suggestions={data?.keyword?.suggestions ?? []} regenerating={regen === 'keyword'} slug={slug} />
      )}
    </>
  );
}

function ContentList({ ideas, regenerating }: { ideas: ContentIdea[]; regenerating: boolean }) {
  if (regenerating) {
    return (
      <div className="card p-8 text-center text-ink-300">
        <Loader2 size={20} className="animate-spin mx-auto mb-2 text-accent-400" />
        Mengenerate ide konten…
      </div>
    );
  }
  if (ideas.length === 0) {
    return (
      <div className="card p-8 text-center text-ink-400">
        Belum ada ide konten — pastikan project sudah punya mention NEGATIF, lalu klik Regenerate.
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {ideas.map((idea, i) => (
        <div key={i} className="card p-4 hover:border-accent-500/40 transition">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="text-base font-semibold text-ink-100 leading-snug">{idea.title}</div>
            <span className={clsx('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap', TONE_STYLES[idea.tone])}>
              {idea.tone}
            </span>
          </div>
          <p className="text-sm text-ink-300 mb-3 leading-relaxed">{idea.concept}</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-ink-500 shrink-0 w-24">Counter issue:</span>
              <span className="text-warning-400 flex-1">{idea.issueCounter}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-ink-500 shrink-0 w-24">Influencer:</span>
              <span className="text-ink-200 flex-1">{idea.influencerType}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function KeywordList({
  suggestions,
  regenerating,
  slug,
}: {
  suggestions: KeywordSuggestion[];
  regenerating: boolean;
  slug: string;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function addKeyword(kw: string) {
    setAdding(kw);
    try {
      const r = await fetch(`/api/projects/${slug}/keywords`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ term: kw }),
      });
      if (r.ok) {
        setAdded((cur) => new Set([...cur, kw]));
      }
    } finally {
      setAdding(null);
    }
  }

  if (regenerating) {
    return (
      <div className="card p-8 text-center text-ink-300">
        <Loader2 size={20} className="animate-spin mx-auto mb-2 text-accent-400" />
        Mencari keyword baru…
      </div>
    );
  }
  if (suggestions.length === 0) {
    return (
      <div className="card p-8 text-center text-ink-400">
        Belum ada saran keyword. Pastikan ada hasil scan dulu, lalu klik Regenerate.
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {suggestions.map((s, i) => {
        const isAdded = added.has(s.keyword);
        return (
          <div key={i} className="card p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <code className="text-sm font-mono text-accent-400 bg-accent-500/10 px-2 py-0.5 rounded">
                  {s.keyword}
                </code>
                <span className={clsx('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border', FIT_STYLES[s.estimatedFit])}>
                  {s.estimatedFit} fit
                </span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-ink-700 text-ink-400">
                  {CAT_LABEL[s.category]}
                </span>
              </div>
              <p className="text-sm text-ink-300 leading-relaxed">{s.rationale}</p>
            </div>
            <button
              onClick={() => addKeyword(s.keyword)}
              disabled={isAdded || adding === s.keyword}
              className={clsx(
                'btn-ghost shrink-0',
                isAdded && 'text-success-500 pointer-events-none',
              )}
              title={isAdded ? 'Sudah ditambahkan' : 'Tambah ke keywords project'}
            >
              {adding === s.keyword
                ? <Loader2 size={14} className="animate-spin" />
                : isAdded ? <span className="text-xs">Added</span> : <Plus size={14} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
