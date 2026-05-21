/**
 * AI Insight — Keyword Suggestions.
 *
 * Recommends additional keywords/aliases for the project's monitoring. Grounded
 * on actual scan results: what variants/aliases appear in real mentions, what
 * topics keep co-occurring, and what's MISSING from current keywords.
 *
 * Output cards each contain:
 *   - keyword       : the suggested term (1-4 words, lowercase)
 *   - rationale     : 1-2 sentences explaining WHY it should be tracked
 *   - estimatedFit  : 'high' | 'medium' | 'low' relative usefulness
 *   - category      : 'alias' | 'topic' | 'critic' | 'ally' | 'context'
 *
 * Cached on Project.insightKeywordJson; regenerated after each scan + on demand.
 */
import { prisma } from '@/lib/prisma';
import { aiClient, aiModel, providerSupportsJsonMode, hasAiConfigured } from '@/lib/aiClient';
import type { Mention } from '@prisma/client';

export interface KeywordSuggestion {
  keyword: string;
  rationale: string;
  estimatedFit: 'high' | 'medium' | 'low';
  category: 'alias' | 'topic' | 'critic' | 'ally' | 'context';
}

export interface CachedInsightKeyword {
  suggestions: KeywordSuggestion[];
  generatedAt: Date;
  error?: string | null;
}

const FITS: KeywordSuggestion['estimatedFit'][] = ['high', 'medium', 'low'];
const CATS: KeywordSuggestion['category'][] = ['alias', 'topic', 'critic', 'ally', 'context'];

interface ProjectShape {
  id: string;
  name: string;
  insightKeywordJson: unknown;
  insightGeneratedAt: Date | null;
  insightError: string | null;
}

export async function regenerateInsightKeyword(projectId: string): Promise<CachedInsightKeyword> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { keywords: true },
  });
  if (!project) throw new Error('Project not found or has been deleted');

  if (!hasAiConfigured()) {
    const placeholder: CachedInsightKeyword = {
      suggestions: [],
      generatedAt: new Date(),
      error: 'AI provider belum dikonfigurasi.',
    };
    await prisma.project.update({
      where: { id: projectId },
      data: {
        insightKeywordJson: placeholder as unknown as object,
        insightGeneratedAt: placeholder.generatedAt,
        insightError: placeholder.error ?? null,
      },
    });
    return placeholder;
  }

  // Recent mentions (mix of sentiments) — let the LLM see what's being discussed.
  const mentions = await prisma.mention.findMany({
    where: { projectId, analyzedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    take: 40,
  });

  if (mentions.length === 0) {
    const result: CachedInsightKeyword = { suggestions: [], generatedAt: new Date(), error: null };
    await prisma.project.update({
      where: { id: projectId },
      data: {
        insightKeywordJson: result as unknown as object,
        insightGeneratedAt: result.generatedAt,
        insightError: null,
      },
    });
    return result;
  }

  const currentKeywords = project.keywords.map((k) => k.term.toLowerCase());

  try {
    const suggestions = await callLlm(project.name, currentKeywords, mentions);
    const filtered = suggestions.filter((s) => !currentKeywords.includes(s.keyword.toLowerCase()));
    const result: CachedInsightKeyword = { suggestions: filtered, generatedAt: new Date(), error: null };
    await prisma.project.update({
      where: { id: projectId },
      data: {
        insightKeywordJson: result as unknown as object,
        insightGeneratedAt: result.generatedAt,
        insightError: null,
      },
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[insightKeyword] generation failed:', msg);
    await prisma.project.update({
      where: { id: projectId },
      data: { insightError: msg.slice(0, 2000), insightGeneratedAt: new Date() },
    });
    return {
      suggestions: readCachedInsightKeyword(project as unknown as ProjectShape)?.suggestions ?? [],
      generatedAt: new Date(),
      error: msg,
    };
  }
}

export function readCachedInsightKeyword(p: ProjectShape): CachedInsightKeyword | null {
  if (!p.insightKeywordJson) return null;
  const raw = p.insightKeywordJson as { suggestions?: unknown[]; error?: string | null };
  const suggestions = Array.isArray(raw.suggestions) ? (raw.suggestions as KeywordSuggestion[]) : [];
  return {
    suggestions,
    generatedAt: p.insightGeneratedAt ?? new Date(0),
    error: p.insightError ?? raw.error ?? null,
  };
}

async function callLlm(
  subject: string,
  currentKeywords: string[],
  mentions: Mention[],
): Promise<KeywordSuggestion[]> {
  const sample = mentions.slice(0, 30).map((m) => ({
    sentiment: m.sentiment,
    topic: m.topic,
    title: m.title,
    summary: m.aiSummary ?? m.snippet,
  }));

  const completion = await aiClient().chat.completions.create({
    model: aiModel(),
    ...(providerSupportsJsonMode() ? { response_format: { type: 'json_object' as const } } : {}),
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content: `Anda analis OSINT / media monitoring untuk subjek "${subject}".
Keyword yang SAAT INI sudah dipantau: ${JSON.stringify(currentKeywords)}.
Berdasarkan sample mention berikut (judul + topik + sentimen), sarankan 6-10 KEYWORD BARU yang HARUS ditambahkan ke monitoring.

Pertimbangan:
- alias    : varian nama, julukan, singkatan, salah eja umum yang sering muncul
- topic    : isu/program yang keep on muncul tapi belum jadi keyword
- critic   : nama tokoh/akun/media yang sering mengkritik
- ally     : nama tokoh/akun/media yang sering mendukung — biar bisa dibandingkan
- context  : kata konteks (kementerian, kebijakan, lembaga) yang sering co-occur

WAJIB exclude keyword yang sudah ada di daftar current.

Output JSON SAJA dengan shape:
{
  "suggestions": [
    {
      "keyword": "kata kunci 1-4 kata (lowercase)",
      "rationale": "1-2 kalimat kenapa harus dipantau",
      "estimatedFit": "high|medium|low",
      "category": "alias|topic|critic|ally|context"
    }
  ]
}
HANYA JSON, tanpa markdown, tanpa pembuka/penutup.`,
      },
      { role: 'user', content: JSON.stringify(sample) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: { suggestions?: unknown[] } = {};
  try { parsed = JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { /* */ } }
  }

  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  return suggestions
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map((x) => ({
      keyword: String(x.keyword ?? '').toLowerCase().slice(0, 80),
      rationale: String(x.rationale ?? '').slice(0, 400),
      estimatedFit: (FITS.includes(x.estimatedFit as KeywordSuggestion['estimatedFit'])
        ? x.estimatedFit
        : 'medium') as KeywordSuggestion['estimatedFit'],
      category: (CATS.includes(x.category as KeywordSuggestion['category'])
        ? x.category
        : 'topic') as KeywordSuggestion['category'],
    }))
    .filter((s) => s.keyword && s.rationale);
}
