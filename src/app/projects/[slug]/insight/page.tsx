'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lightbulb, RefreshCw, Sparkles, Tag, AlertTriangle, ChevronDown, ChevronUp, Plus, Loader2, CheckCircle2, RotateCcw, Megaphone, Target, Zap, ListChecks, ArrowRight, Shield, Heart } from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch } from '@/lib/api-client';

// ─────────────────────────────────────────────────────────────────────────────
// Shape mirrors src/services/insight{Content,Keyword}.ts. Kept inline so the
// page can render without pulling server-only modules into the client bundle.
// ─────────────────────────────────────────────────────────────────────────────
type ContentEmotion =
  | 'hope' | 'pride' | 'empathy' | 'curiosity' | 'indignation' | 'reassurance' | 'inspiration';
type ContentFormat =
  | 'tiktok-reel' | 'instagram-reel' | 'twitter-thread' | 'youtube-short'
  | 'youtube-long' | 'podcast-cut' | 'linkedin-post' | 'opinion-piece' | 'livestream';
type CounterTechnique =
  | 'reframe' | 'contextualize' | 'third-party-validate' | 'steel-man'
  | 'data-overlay' | 'human-interest' | 'transparency' | 'comparative';

interface ContentIdea {
  id: string;
  title: string;
  concept: string;
  influencerType: string;
  issueCounter: string;
  tone: 'informational' | 'emotional' | 'data-driven' | 'human-interest';
  angle?: string;
  hook?: string;
  emotion?: ContentEmotion;
  format?: ContentFormat;
  counterTechnique?: CounterTechnique;
  targetPerception?: { from: string; to: string };
  keyPoints?: string[];
  cta?: string;
  risk?: string;
  completed?: boolean;
  completedAt?: string;
}

interface KeywordSuggestion {
  keyword: string;
  rationale: string;
  estimatedFit: 'high' | 'medium' | 'low';
  category: 'alias' | 'topic' | 'critic' | 'ally' | 'context';
}

interface CachedContent { ideas: ContentIdea[]; resolvedIssues?: string[]; generatedAt: string; error?: string | null }
interface CachedKeyword { suggestions: KeywordSuggestion[]; generatedAt: string; error?: string | null }

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
  // Lazy per-view caches — each view fetches independently the first time it's
  // opened. Switching tabs re-uses the cache (no re-fetch) unless the user hits
  // Regenerate or the page is reloaded.
  const [contentCache, setContentCache] = useState<CachedContent | null>(null);
  const [keywordCache, setKeywordCache] = useState<CachedKeyword | null>(null);
  const [loadingView, setLoadingView] = useState<View | null>(null);
  const [regen, setRegen] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // SYNC guards so concurrent calls (StrictMode double-invoke, HMR, fast clicks)
  // don't trigger duplicate fetches. State-based check (contentCache/keywordCache)
  // isn't enough because setState is async — the second invocation sees null cache.
  const inFlight = useRef<Set<View>>(new Set());
  const fetched = useRef<Set<View>>(new Set());

  // Fetch one view's data on demand. Idempotent across re-mounts.
  const loadView = useCallback(async (v: View, force = false) => {
    if (!force) {
      if (inFlight.current.has(v) || fetched.current.has(v)) return;
    }
    inFlight.current.add(v);
    setLoadingView(v);
    setError(null);
    try {
      const r = await apiFetch(`/api/projects/${slug}/insight/${v}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `Gagal memuat insight (${r.status})`);
        return;
      }
      const j = await r.json();
      fetched.current.add(v);
      if (v === 'content') setContentCache(j.content ?? null);
      else setKeywordCache(j.keyword ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat insight');
    } finally {
      inFlight.current.delete(v);
      setLoadingView(null);
    }
  }, [slug]);

  // StrictMode guard — fetch the active view exactly once on mount.
  // View-switching fetches are handled inline in the dropdown's onClick to
  // avoid double-firing effects in dev.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void loadView(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function regenerate(type: View) {
    setRegen(type);
    setError(null);
    try {
      const r = await apiFetch(`/api/projects/${slug}/insight/${type}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? 'Regenerate gagal');
        return;
      }
      // Regenerate returns fresh data — treat as already-fetched so we don't
      // immediately refetch on next render.
      fetched.current.add(type);
      if (type === 'content') setContentCache(j.content ?? null);
      else setKeywordCache(j.keyword ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regenerate gagal');
    } finally {
      setRegen(null);
    }
  }

  const current = VIEWS.find((v) => v.id === view)!;
  const ActiveIcon = current.icon;
  const generatedAt = useMemo(() => {
    const t = view === 'content' ? contentCache?.generatedAt : keywordCache?.generatedAt;
    if (!t) return null;
    const d = new Date(t);
    if (d.getTime() === 0) return null;
    return d.toLocaleString('id-ID');
  }, [view, contentCache, keywordCache]);

  const lastError = view === 'content' ? contentCache?.error : keywordCache?.error;
  const loading = loadingView === view && (view === 'content' ? !contentCache : !keywordCache);

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
                  onClick={() => {
                    setView(v.id);
                    setOpen(false);
                    // Lazy-fetch the newly active view if it isn't cached yet.
                    void loadView(v.id);
                  }}
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
        <ContentList
          ideas={contentCache?.ideas ?? []}
          regenerating={regen === 'content'}
          slug={slug}
          onChange={(next) => setContentCache(next)}
        />
      ) : (
        <KeywordList suggestions={keywordCache?.suggestions ?? []} regenerating={regen === 'keyword'} slug={slug} />
      )}
    </>
  );
}

function ContentList({
  ideas,
  regenerating,
  slug,
  onChange,
}: {
  ideas: ContentIdea[];
  regenerating: boolean;
  slug: string;
  onChange: (next: CachedContent) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const completedCount = ideas.filter((i) => i.completed).length;
  const visibleIdeas = showCompleted ? ideas : ideas.filter((i) => !i.completed);

  async function toggleComplete(idea: ContentIdea) {
    setBusy(idea.id);
    try {
      const r = await apiFetch(`/api/projects/${slug}/insight/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ideaId: idea.id, completed: !idea.completed }),
      });
      if (r.ok) {
        const j = await r.json();
        if (j.content) onChange(j.content);
      }
    } finally {
      setBusy(null);
    }
  }

  function toggleOpen(id: string) {
    setOpenIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (regenerating) {
    return (
      <div className="card p-8 text-center text-ink-300">
        <Loader2 size={20} className="animate-spin mx-auto mb-2 text-accent-400" />
        Mengenerate brief konten…
      </div>
    );
  }
  if (ideas.length === 0) {
    return (
      <div className="card p-8 text-center text-ink-400">
        Belum ada brief konten — pastikan project sudah punya mention NEGATIF, lalu klik Regenerate.
      </div>
    );
  }

  return (
    <>
      {completedCount > 0 && (
        <div className="mb-4 flex items-center justify-between text-xs">
          <div className="text-ink-400">
            <span className="text-success-500 font-medium">{completedCount}</span> sudah ditandai selesai
            {' · '}
            <span className="text-ink-500">Issue yang sudah selesai tidak akan disuggest lagi saat regenerate.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="text-accent-400 hover:text-accent-500"
          >
            {showCompleted ? 'Sembunyikan yang selesai' : `Tampilkan yang selesai (${completedCount})`}
          </button>
        </div>
      )}

      <div className="grid gap-3">
        {visibleIdeas.map((idea) => (
          <ContentIdeaCard
            key={idea.id}
            idea={idea}
            open={openIds.has(idea.id)}
            onToggleOpen={() => toggleOpen(idea.id)}
            onToggleComplete={() => toggleComplete(idea)}
            busy={busy === idea.id}
          />
        ))}
      </div>
    </>
  );
}

const EMOTION_STYLES: Record<ContentEmotion, string> = {
  hope: 'bg-success-500/10 text-success-500 border-success-500/30',
  pride: 'bg-warning-500/10 text-warning-500 border-warning-500/30',
  empathy: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  curiosity: 'bg-accent-500/10 text-accent-400 border-accent-500/30',
  indignation: 'bg-danger-500/10 text-danger-500 border-danger-500/30',
  reassurance: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  inspiration: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

const FORMAT_LABEL: Record<ContentFormat, string> = {
  'tiktok-reel': 'TikTok Reel',
  'instagram-reel': 'IG Reel',
  'twitter-thread': 'X / Twitter Thread',
  'youtube-short': 'YT Short',
  'youtube-long': 'YT Long-form',
  'podcast-cut': 'Podcast Cut',
  'linkedin-post': 'LinkedIn Post',
  'opinion-piece': 'Opinion Piece',
  'livestream': 'Livestream',
};

const COUNTER_LABEL: Record<CounterTechnique, string> = {
  reframe: 'Reframe',
  contextualize: 'Contextualize',
  'third-party-validate': 'Third-party Validation',
  'steel-man': 'Steel-man',
  'data-overlay': 'Data Overlay',
  'human-interest': 'Human Interest',
  transparency: 'Transparency',
  comparative: 'Comparative',
};

function ContentIdeaCard({
  idea,
  open,
  onToggleOpen,
  onToggleComplete,
  busy,
}: {
  idea: ContentIdea;
  open: boolean;
  onToggleOpen: () => void;
  onToggleComplete: () => void;
  busy: boolean;
}) {
  const isDone = !!idea.completed;
  const hasBrief =
    !!idea.angle || !!idea.hook || (idea.keyPoints?.length ?? 0) > 0 || !!idea.cta ||
    !!idea.targetPerception || !!idea.counterTechnique || !!idea.format || !!idea.emotion;

  return (
    <div
      className={clsx(
        'card transition relative',
        isDone
          ? 'opacity-60 border-success-500/30 bg-success-500/5'
          : 'hover:border-accent-500/40',
      )}
    >
      {/* Header */}
      <div className="p-4 pb-3.5">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className={clsx('text-[15px] font-semibold leading-snug flex-1 tracking-tight', isDone ? 'text-ink-300' : 'text-ink-100')}>
            {isDone && <CheckCircle2 size={14} className="inline mr-1.5 -mt-0.5 text-success-500" />}
            {idea.title}
          </div>
          <span className={clsx('text-[10px] font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0', TONE_STYLES[idea.tone])}>
            {idea.tone}
          </span>
        </div>

        {/* Mini metadata row */}
        {(idea.format || idea.emotion || idea.counterTechnique) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {idea.format && (
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border border-ink-700 text-ink-300 flex items-center gap-1">
                <Megaphone size={10} /> {FORMAT_LABEL[idea.format]}
              </span>
            )}
            {idea.emotion && (
              <span className={clsx('text-[10px] font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border flex items-center gap-1', EMOTION_STYLES[idea.emotion])}>
                <Heart size={10} /> {idea.emotion}
              </span>
            )}
            {idea.counterTechnique && (
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border border-ink-700 text-ink-300 flex items-center gap-1">
                <Shield size={10} /> {COUNTER_LABEL[idea.counterTechnique]}
              </span>
            )}
          </div>
        )}

        <p className={clsx('text-[13px] leading-relaxed', isDone ? 'text-ink-400' : 'text-ink-300')}>
          {idea.concept}
        </p>

        <div className="mt-3 space-y-1.5 text-[12px]">
          <div className="flex items-start gap-2">
            <span className="text-ink-500 shrink-0 w-20 text-[11px] uppercase tracking-[0.05em] mt-0.5">Counter issue</span>
            <span className={clsx('flex-1', isDone ? 'text-ink-400 line-through' : 'text-warning-400')}>{idea.issueCounter}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-ink-500 shrink-0 w-20 text-[11px] uppercase tracking-[0.05em] mt-0.5">Influencer</span>
            <span className={clsx('flex-1', isDone ? 'text-ink-400' : 'text-ink-200')}>{idea.influencerType}</span>
          </div>
        </div>
      </div>

      {/* Expandable strategic brief */}
      {hasBrief && (
        <button
          type="button"
          onClick={onToggleOpen}
          className="w-full px-4 py-2 border-t border-ink-800 flex items-center justify-between text-xs text-ink-300 hover:bg-ink-800/30 transition"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles size={11} className="text-accent-400" />
            {open ? 'Tutup brief detail' : 'Lihat brief detail'}
          </span>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}

      {hasBrief && open && (
        <div className="px-4 py-3.5 border-t border-ink-800 bg-ink-900/40 space-y-3.5">
          {idea.angle && (
            <Section icon={<Target size={12} />} label="Narrative angle">
              <p>{idea.angle}</p>
            </Section>
          )}

          {idea.hook && (
            <Section icon={<Zap size={12} className="text-warning-500" />} label="Hook opening (3 detik)">
              <p className="text-ink-100 italic border-l-2 border-warning-500/40 pl-3 py-0.5">
                &ldquo;{idea.hook}&rdquo;
              </p>
            </Section>
          )}

          {idea.targetPerception && (
            <Section icon={<ArrowRight size={12} />} label="Pergeseran persepsi">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-1 rounded-md bg-danger-500/10 text-danger-400 border border-danger-500/20 text-[12px]">
                  {idea.targetPerception.from}
                </span>
                <ArrowRight size={11} className="text-ink-500 shrink-0" />
                <span className="px-2 py-1 rounded-md bg-success-500/10 text-success-500 border border-success-500/20 text-[12px]">
                  {idea.targetPerception.to}
                </span>
              </div>
            </Section>
          )}

          {idea.keyPoints && idea.keyPoints.length > 0 && (
            <Section icon={<ListChecks size={12} />} label="Talking points">
              <ul className="space-y-1.5">
                {idea.keyPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="text-accent-400 shrink-0 text-[11px] font-semibold tabular-nums mt-px w-4">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="flex-1">{point}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {idea.cta && (
            <Section icon={<Megaphone size={12} className="text-accent-400" />} label="Audience CTA">
              <p>{idea.cta}</p>
            </Section>
          )}

          {idea.risk && (
            <Section icon={<AlertTriangle size={12} className="text-warning-500" />} label="Potensi risiko">
              <p className="text-warning-400">{idea.risk}</p>
            </Section>
          )}
        </div>
      )}

      {/* Footer: Mark as Complete */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onToggleComplete}
          disabled={busy}
          className={clsx(
            'w-full text-xs py-1.5 px-3 rounded-md border transition flex items-center justify-center gap-1.5',
            isDone
              ? 'border-ink-700 hover:border-ink-600 text-ink-300'
              : 'border-success-500/40 bg-success-500/5 hover:bg-success-500/10 text-success-500',
          )}
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : isDone ? (
            <RotateCcw size={12} />
          ) : (
            <CheckCircle2 size={12} />
          )}
          {isDone ? 'Mark as Open' : 'Mark as Complete'}
        </button>
      </div>
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-500 mb-1.5 flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="text-[13px] leading-relaxed text-ink-200">
        {children}
      </div>
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
      const r = await apiFetch(`/api/projects/${slug}/keywords`, {
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
