/**
 * AI Insight — Content Counter Ideas.
 *
 * Generates structured content concepts intended to counter NEGATIVE coverage
 * of the project's subject. Output is a list of cards, each with:
 *   - title           : catchy hook for the content idea
 *   - concept         : 2-3 sentences describing the angle
 *   - influencerType  : suggested kind of influencer / channel that fits
 *   - issueCounter    : which negative topic this is meant to push back against
 *   - tone            : informational / emotional / data-driven / human-interest
 *
 * The LLM is grounded on REAL negative mentions from the project so the ideas
 * actually address what's being said — not generic PR fluff.
 *
 * Cached on Project.insightContentJson; regenerated after each scan + on demand.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { aiClient, aiModel, providerSupportsJsonMode, hasAiConfigured } from '@/lib/aiClient';
import type { Mention } from '@prisma/client';

export type ContentEmotion =
  | 'hope' | 'pride' | 'empathy' | 'curiosity' | 'indignation' | 'reassurance' | 'inspiration';

export type ContentFormat =
  | 'tiktok-reel' | 'instagram-reel' | 'twitter-thread' | 'youtube-short'
  | 'youtube-long' | 'podcast-cut' | 'linkedin-post' | 'opinion-piece' | 'livestream';

export type CounterTechnique =
  | 'reframe'              // ganti sudut pandang, bukan denial
  | 'contextualize'        // tambah konteks data/sejarah yang absent dari berita
  | 'third-party-validate' // pakai voice pihak ke-3 kredibel (akademisi, lembaga)
  | 'steel-man'            // akui kritik valid dulu, lalu nuance
  | 'data-overlay'         // angka/statistik yang patahkan klaim
  | 'human-interest'       // kasus konkret penerima manfaat
  | 'transparency'         // tunjukin proses internal, bukti dokumentasi
  | 'comparative';         // bandingin sama benchmark relevan

export interface ContentIdea {
  id: string;
  title: string;
  /** Ringkasan 1-paragraf — kayak elevator pitch ke creator */
  concept: string;
  influencerType: string;
  issueCounter: string;
  tone: 'informational' | 'emotional' | 'data-driven' | 'human-interest';

  // ---- Strategic brief fields ----
  /** Narrative angle / POV inti dari konten. */
  angle?: string;
  /** Opening 3-detik / hook scroll-stopper. */
  hook?: string;
  /** Emosi primer yang ditargetkan. */
  emotion?: ContentEmotion;
  /** Format konten spesifik. */
  format?: ContentFormat;
  /** Counter technique — gimana cara meng-counter, bukan defensive. */
  counterTechnique?: CounterTechnique;
  /** Pergeseran persepsi: dari X → ke Y. */
  targetPerception?: { from: string; to: string };
  /** 3-5 talking points kongkret untuk creator. */
  keyPoints?: string[];
  /** Call-to-action: apa yang audience harapkan rasa/lakukan setelah konsumsi konten. */
  cta?: string;
  /** Potensi risiko / backfire — kasih PR readiness. */
  risk?: string;

  // ---- Lifecycle ----
  completed?: boolean;
  completedAt?: string;
}

export interface CachedInsightContent {
  ideas: ContentIdea[];
  /** issueCounter strings the user has marked as resolved.  Used to suppress
   *  duplicate LLM suggestions on the next regenerate. */
  resolvedIssues: string[];
  generatedAt: Date;
  error?: string | null;
}

const TONES: ContentIdea['tone'][] = ['informational', 'emotional', 'data-driven', 'human-interest'];

interface ProjectShape {
  id: string;
  name: string;
  insightContentJson: unknown;
  insightGeneratedAt: Date | null;
  insightError: string | null;
}

export async function regenerateInsightContent(projectId: string): Promise<CachedInsightContent> {
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) throw new Error('Project not found or has been deleted');

  // Carry forward what user has already curated: completed ideas + resolved-issue list.
  // We never throw these away on regen — they're how the user trains the next round.
  const existing = readCachedInsightContent(project as unknown as ProjectShape);
  const carriedCompleted = (existing?.ideas ?? []).filter((i) => i.completed);
  const resolvedIssues = Array.from(new Set([
    ...(existing?.resolvedIssues ?? []),
    ...carriedCompleted.map((i) => i.issueCounter).filter(Boolean),
  ]));

  if (!hasAiConfigured()) {
    const placeholder: CachedInsightContent = {
      ideas: carriedCompleted,
      resolvedIssues,
      generatedAt: new Date(),
      error: 'AI provider belum dikonfigurasi.',
    };
    await persist(projectId, placeholder);
    return placeholder;
  }

  // Pull up to 25 most-recent NEGATIVE mentions as grounding context.
  const negatives = await prisma.mention.findMany({
    where: { projectId, sentiment: 'NEGATIVE', analyzedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    take: 25,
  });

  if (negatives.length === 0) {
    const result: CachedInsightContent = {
      ideas: carriedCompleted,
      resolvedIssues,
      generatedAt: new Date(),
      error: null,
    };
    await persist(projectId, result);
    return result;
  }

  try {
    const rawIdeas = await callLlm(project.name, negatives, resolvedIssues);
    // Filter out anything the LLM suggested that still maps to a resolved issue
    // (belt-and-braces — the prompt already tells it not to).
    const resolvedLower = new Set(resolvedIssues.map((r) => r.toLowerCase().trim()));
    const fresh = rawIdeas
      .filter((i) => !resolvedLower.has(i.issueCounter.toLowerCase().trim()))
      .map((i) => ({ ...i, id: randomUUID(), completed: false }));

    const ideas = [...carriedCompleted, ...fresh];
    const result: CachedInsightContent = {
      ideas,
      resolvedIssues,
      generatedAt: new Date(),
      error: null,
    };
    await persist(projectId, result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[insightContent] generation failed:', msg);
    await prisma.project.update({
      where: { id: projectId },
      data: { insightError: msg.slice(0, 2000), insightGeneratedAt: new Date() },
    });
    return {
      ideas: existing?.ideas ?? [],
      resolvedIssues,
      generatedAt: new Date(),
      error: msg,
    };
  }
}

async function persist(projectId: string, payload: CachedInsightContent): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: {
      insightContentJson: payload as unknown as object,
      insightGeneratedAt: payload.generatedAt,
      insightError: payload.error ?? null,
    },
  });
}

/**
 * Toggle an idea's completed state. When marking complete, the idea's
 * issueCounter is added to the resolvedIssues list so future regens skip it.
 * When un-marking, the idea is left in place but the resolved-issue is NOT
 * removed (we don't want one accidental click to undo a user's curation
 * — they can use the explicit \`unresolveIssue\` helper for that).
 */
export async function setIdeaCompleted(
  projectId: string,
  ideaId: string,
  completed: boolean,
): Promise<CachedInsightContent | null> {
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) return null;
  const cur = readCachedInsightContent(project as unknown as ProjectShape);
  if (!cur) return null;

  let touched = false;
  const ideas = cur.ideas.map((i) => {
    if (i.id !== ideaId) return i;
    touched = true;
    return {
      ...i,
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
    };
  });
  if (!touched) return cur;

  const target = ideas.find((i) => i.id === ideaId);
  let resolvedIssues = cur.resolvedIssues ?? [];
  if (completed && target?.issueCounter) {
    const key = target.issueCounter;
    if (!resolvedIssues.includes(key)) resolvedIssues = [...resolvedIssues, key];
  }

  const next: CachedInsightContent = {
    ideas,
    resolvedIssues,
    generatedAt: cur.generatedAt,
    error: cur.error ?? null,
  };
  await persist(projectId, next);
  return next;
}

export function readCachedInsightContent(p: ProjectShape): CachedInsightContent | null {
  if (!p.insightContentJson) return null;
  const raw = p.insightContentJson as { ideas?: unknown[]; resolvedIssues?: unknown[]; error?: string | null };
  const ideas = Array.isArray(raw.ideas)
    ? (raw.ideas as ContentIdea[]).map((i) => ({
        ...i,
        // Back-compat: older cached entries didn't have id. Generate stable-ish
        // ids from issueCounter+title so the UI can still address them.
        id: i.id ?? `legacy:${(i.issueCounter ?? '') + ':' + (i.title ?? '')}`,
        completed: i.completed ?? false,
      }))
    : [];
  const resolvedIssues = Array.isArray(raw.resolvedIssues)
    ? raw.resolvedIssues.filter((x): x is string => typeof x === 'string')
    : [];
  return {
    ideas,
    resolvedIssues,
    generatedAt: p.insightGeneratedAt ?? new Date(0),
    error: p.insightError ?? raw.error ?? null,
  };
}

const EMOTIONS: ContentEmotion[] = ['hope', 'pride', 'empathy', 'curiosity', 'indignation', 'reassurance', 'inspiration'];
const FORMATS: ContentFormat[] = ['tiktok-reel', 'instagram-reel', 'twitter-thread', 'youtube-short', 'youtube-long', 'podcast-cut', 'linkedin-post', 'opinion-piece', 'livestream'];
const COUNTER_TECHNIQUES: CounterTechnique[] = ['reframe', 'contextualize', 'third-party-validate', 'steel-man', 'data-overlay', 'human-interest', 'transparency', 'comparative'];

async function callLlm(subject: string, negatives: Mention[], resolvedIssues: string[]): Promise<Omit<ContentIdea, 'id' | 'completed' | 'completedAt'>[]> {
  const samples = negatives.slice(0, 20).map((m) => ({
    source: m.sourceName,
    score: m.sentimentScore,
    topic: m.topic,
    title: m.title,
    summary: m.aiSummary ?? m.snippet,
  }));

  const completion = await aiClient().chat.completions.create({
    model: aiModel(),
    ...(providerSupportsJsonMode() ? { response_format: { type: 'json_object' as const } } : {}),
    temperature: 0.75,
    messages: [
      {
        role: 'system',
        content: `Anda adalah Senior Content Strategist + Crisis Communications planner untuk subjek publik/korporat Indonesia.
Tugas Anda: BERIKAN BRIEF KONTEN siap-eksekusi yang influencer/KOL bisa langsung ambil dan produksi tanpa mikir tambahan.

KONTEKS: Berikut adalah mention NEGATIF terbaru tentang "${subject}". Buat 5-7 BRIEF KONTEN untuk meng-counter / menyeimbangkan narasi tersebut.

PRINSIP WAJIB:
1. JANGAN defensive, JANGAN denial. Yang dipakai: reframe konteks, data overlay, third-party validation, atau human-interest. Steel-man kritik dulu kalau perlu — itu lebih kredibel.
2. Setiap brief harus action-able: creator harus tau persis hook, format, dan talking points-nya.
3. Beragam tone & emotion — jangan semua data-driven, jangan semua emotional.
4. Beragam format — campur reel, thread, podcast cut, opinion piece. Format harus cocok sama tone dan emotion-nya.
5. Setiap brief MERUJUK ke issue spesifik dari berita di bawah (di field issueCounter).

EXCLUSION — JANGAN buat brief untuk issue-issue berikut (sudah selesai / sudah di-counter sebelumnya):
${resolvedIssues.length ? resolvedIssues.map((r) => `- ${r}`).join('\n') : '(belum ada)'}

OUTPUT JSON SAJA. Shape:
{
  "ideas": [
    {
      "title": "judul brief singkat & catchy (max 60 char)",
      "concept": "1 paragraf elevator pitch ke creator (3-4 kalimat)",
      "issueCounter": "issue negatif spesifik yang di-counter (max 70 char)",
      "tone": "informational|emotional|data-driven|human-interest",

      "angle": "POV / narrative angle inti — 1 kalimat tajam",
      "hook": "Opening 3-detik / scroll-stopper. Tulis verbatim, bukan deskripsi. Contoh: 'Bea Cukai naikkan tarif? Tunggu, ini yang gak ada di berita.'",
      "emotion": "hope|pride|empathy|curiosity|indignation|reassurance|inspiration",
      "format": "tiktok-reel|instagram-reel|twitter-thread|youtube-short|youtube-long|podcast-cut|linkedin-post|opinion-piece|livestream",
      "counterTechnique": "reframe|contextualize|third-party-validate|steel-man|data-overlay|human-interest|transparency|comparative",
      "targetPerception": {
        "from": "persepsi publik saat ini (5-10 kata)",
        "to": "persepsi yang ingin dibangun (5-10 kata)"
      },
      "keyPoints": [
        "3-5 talking point kongkret, masing-masing 1 kalimat",
        "Bukan jargon — bahasa creator pop"
      ],
      "cta": "Apa yang audience harapkan rasa/pikir/lakukan setelah konsumsi konten",
      "influencerType": "Tipe creator + alasan kenapa cocok (mis: 'finfluencer ekonomi makro karena kredibel di topik fiskal')",
      "risk": "1 kalimat potensi backfire / kritik balik yang harus diantisipasi"
    }
  ]
}

ATURAN OUTPUT:
- HANYA JSON, tanpa pembuka/penutup, tanpa markdown fence.
- Bahasa Indonesia. Tone professional tapi natural — bukan birokratis.
- Setiap brief harus UNIK dari yang lain (jangan repeat angle/format/emotion yang sama).`,
      },
      { role: 'user', content: JSON.stringify(samples) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: { ideas?: unknown[] } = {};
  try { parsed = JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { /* */ } }
  }

  const ideas = Array.isArray(parsed.ideas) ? parsed.ideas : [];
  return ideas
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map((x) => {
      const tp = x.targetPerception as { from?: unknown; to?: unknown } | undefined;
      const kp = Array.isArray(x.keyPoints) ? x.keyPoints : [];
      return {
        title: String(x.title ?? '').slice(0, 120),
        concept: String(x.concept ?? '').slice(0, 800),
        influencerType: String(x.influencerType ?? '').slice(0, 200),
        issueCounter: String(x.issueCounter ?? '').slice(0, 200),
        tone: (TONES.includes(x.tone as ContentIdea['tone']) ? x.tone : 'informational') as ContentIdea['tone'],
        angle: x.angle ? String(x.angle).slice(0, 400) : undefined,
        hook: x.hook ? String(x.hook).slice(0, 400) : undefined,
        emotion: (EMOTIONS.includes(x.emotion as ContentEmotion) ? x.emotion : undefined) as ContentEmotion | undefined,
        format: (FORMATS.includes(x.format as ContentFormat) ? x.format : undefined) as ContentFormat | undefined,
        counterTechnique: (COUNTER_TECHNIQUES.includes(x.counterTechnique as CounterTechnique) ? x.counterTechnique : undefined) as CounterTechnique | undefined,
        targetPerception: tp && typeof tp === 'object'
          ? { from: String(tp.from ?? '').slice(0, 200), to: String(tp.to ?? '').slice(0, 200) }
          : undefined,
        keyPoints: kp
          .filter((p): p is string => typeof p === 'string')
          .map((p) => p.slice(0, 250))
          .slice(0, 6),
        cta: x.cta ? String(x.cta).slice(0, 300) : undefined,
        risk: x.risk ? String(x.risk).slice(0, 300) : undefined,
      };
    })
    .filter((i) => i.title && i.concept);
}
