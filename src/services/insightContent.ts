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

export interface ContentIdea {
  id: string;                  // stable UUID assigned server-side; used by /complete endpoint
  title: string;
  concept: string;
  influencerType: string;
  issueCounter: string;
  tone: 'informational' | 'emotional' | 'data-driven' | 'human-interest';
  completed?: boolean;         // user marked this idea as done
  completedAt?: string;        // ISO timestamp when completed (for sorting/history)
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
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `Anda strategist content marketing untuk humas politik/korporat Indonesia.
Berdasarkan daftar mention NEGATIF tentang subjek "${subject}", buat 5-7 IDE KONTEN yang bisa diberikan ke influencer/KOL untuk meng-counter atau menyeimbangkan narasi tersebut.

IDE-IDE harus:
- Bukan denial/spin yang mudah dipatahkan. Tujuannya melengkapi konteks, menjelaskan kebijakan, atau menonjolkan capaian nyata.
- Cocok untuk dieksekusi influencer (bisa 1 reel TikTok, 1 thread, 1 podcast cut, dll).
- Beragam tone (data-driven, emotional, human-interest, informational).

WAJIB JANGAN BUAT IDE untuk issue-issue berikut (sudah selesai / sudah di-counter sebelumnya):
${resolvedIssues.length ? resolvedIssues.map((r) => `- ${r}`).join('\n') : '(belum ada)'}

Output JSON SAJA dengan shape:
{
  "ideas": [
    {
      "title": "judul ide singkat (max 60 karakter)",
      "concept": "2-3 kalimat menjelaskan angle & narasi kunci",
      "influencerType": "tipe influencer yang cocok (mis: 'finfluencer', 'jurnalis ekonomi', 'creator policy explainer')",
      "issueCounter": "issue negatif spesifik yang di-counter (singkat, max 70 karakter)",
      "tone": "informational|emotional|data-driven|human-interest"
    }
  ]
}
HANYA JSON, tanpa teks pembuka/penutup, tanpa markdown.`,
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
    .map((x) => ({
      title: String(x.title ?? '').slice(0, 120),
      concept: String(x.concept ?? '').slice(0, 600),
      influencerType: String(x.influencerType ?? '').slice(0, 120),
      issueCounter: String(x.issueCounter ?? '').slice(0, 200),
      tone: (TONES.includes(x.tone as ContentIdea['tone']) ? x.tone : 'informational') as ContentIdea['tone'],
    }))
    .filter((i) => i.title && i.concept);
}
