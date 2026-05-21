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
import { prisma } from '@/lib/prisma';
import { aiClient, aiModel, providerSupportsJsonMode, hasAiConfigured } from '@/lib/aiClient';
import type { Mention } from '@prisma/client';

export interface ContentIdea {
  title: string;
  concept: string;
  influencerType: string;
  issueCounter: string;
  tone: 'informational' | 'emotional' | 'data-driven' | 'human-interest';
}

export interface CachedInsightContent {
  ideas: ContentIdea[];
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

  if (!hasAiConfigured()) {
    const placeholder: CachedInsightContent = {
      ideas: [],
      generatedAt: new Date(),
      error: 'AI provider belum dikonfigurasi.',
    };
    await prisma.project.update({
      where: { id: projectId },
      data: {
        insightContentJson: placeholder as unknown as object,
        insightGeneratedAt: placeholder.generatedAt,
        insightError: placeholder.error ?? null,
      },
    });
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
      ideas: [],
      generatedAt: new Date(),
      error: null,
    };
    await prisma.project.update({
      where: { id: projectId },
      data: {
        insightContentJson: result as unknown as object,
        insightGeneratedAt: result.generatedAt,
        insightError: null,
      },
    });
    return result;
  }

  try {
    const ideas = await callLlm(project.name, negatives);
    const result: CachedInsightContent = { ideas, generatedAt: new Date(), error: null };
    await prisma.project.update({
      where: { id: projectId },
      data: {
        insightContentJson: result as unknown as object,
        insightGeneratedAt: result.generatedAt,
        insightError: null,
      },
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[insightContent] generation failed:', msg);
    await prisma.project.update({
      where: { id: projectId },
      data: { insightError: msg.slice(0, 2000), insightGeneratedAt: new Date() },
    });
    return {
      ideas: readCachedInsightContent(project as unknown as ProjectShape)?.ideas ?? [],
      generatedAt: new Date(),
      error: msg,
    };
  }
}

export function readCachedInsightContent(p: ProjectShape): CachedInsightContent | null {
  if (!p.insightContentJson) return null;
  const raw = p.insightContentJson as { ideas?: unknown[]; error?: string | null };
  const ideas = Array.isArray(raw.ideas) ? (raw.ideas as ContentIdea[]) : [];
  return {
    ideas,
    generatedAt: p.insightGeneratedAt ?? new Date(0),
    error: p.insightError ?? raw.error ?? null,
  };
}

async function callLlm(subject: string, negatives: Mention[]): Promise<ContentIdea[]> {
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
