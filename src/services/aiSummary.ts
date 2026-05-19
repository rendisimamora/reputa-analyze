/**
 * AI executive summary generator.
 *
 * Cached on Project (aiExecutive, aiRecommendation, aiSummaryAt) so we never
 * call the LLM on plain dashboard loads — only after a scan/reanalyze that
 * produced fresh analyzed mentions, or when the user explicitly regenerates.
 */
import { prisma } from '@/lib/prisma';
import { aiClient, aiModel, providerSupportsJsonMode, hasAiConfigured } from '@/lib/aiClient';
import { computeReputation } from './reputationScore';
import type { Mention } from '@prisma/client';

export interface CachedAiSummary {
  executive: string;
  recommendation: string;
  generatedAt: Date;
  error?: string | null;
}

interface ProjectShape {
  id: string;
  name: string;
  aiExecutive: string | null;
  aiRecommendation: string | null;
  aiSummaryAt: Date | null;
  aiSummaryError: string | null;
}

/**
 * Regenerate the AI summary for a project and persist it.
 * Safe to call after every scan — internally guards against:
 *  - no AI provider configured -> writes a friendly placeholder
 *  - zero analyzed mentions    -> writes "belum ada mention" placeholder
 *  - LLM errors                -> stores aiSummaryError, keeps last good summary
 */
export async function regenerateAiSummary(projectId: string): Promise<CachedAiSummary> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  // No provider configured -> store deterministic placeholder
  if (!hasAiConfigured()) {
    const placeholder = {
      executive: 'AI provider belum dikonfigurasi. Set AI_PROVIDER + key di .env untuk mengaktifkan executive summary otomatis.',
      recommendation: 'Konfigurasikan Groq (gratis) atau OpenAI di file .env, lalu jalankan scan ulang.',
    };
    await prisma.project.update({
      where: { id: projectId },
      data: {
        aiExecutive: placeholder.executive,
        aiRecommendation: placeholder.recommendation,
        aiSummaryAt: new Date(),
        aiSummaryError: null,
      },
    });
    return { ...placeholder, generatedAt: new Date(), error: null };
  }

  const mentions = await prisma.mention.findMany({
    where: { projectId, analyzedAt: { not: null }, sentiment: { not: null } },
    orderBy: { publishedAt: 'desc' },
    take: 60,
  });

  if (mentions.length === 0) {
    const placeholder = {
      executive: `Belum ada mention yang dianalisis untuk "${project.name}". Coba kata kunci yang lebih sederhana — singkatan, brand, atau nama tokoh tanpa gelar.`,
      recommendation: 'Jalankan scan dengan keyword yang lebih umum (1-3 kata). Hindari frasa panjang yang jarang ditulis utuh di artikel berita.',
    };
    await prisma.project.update({
      where: { id: projectId },
      data: {
        aiExecutive: placeholder.executive,
        aiRecommendation: placeholder.recommendation,
        aiSummaryAt: new Date(),
        aiSummaryError: null,
      },
    });
    return { ...placeholder, generatedAt: new Date(), error: null };
  }

  // Compute fresh reputation for context
  const allMentions = await prisma.mention.findMany({ where: { projectId } });
  const rep = computeReputation(allMentions);

  try {
    const result = await callLlm(project.name, mentions, rep.score, rep.category);
    await prisma.project.update({
      where: { id: projectId },
      data: {
        aiExecutive: result.executive,
        aiRecommendation: result.recommendation,
        aiSummaryAt: new Date(),
        aiSummaryError: null,
      },
    });
    return { ...result, generatedAt: new Date(), error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[aiSummary] generation failed:', msg);
    // Keep the last good summary if any; only update the error field + timestamp.
    await prisma.project.update({
      where: { id: projectId },
      data: { aiSummaryError: msg.slice(0, 2000), aiSummaryAt: new Date() },
    });
    return {
      executive: project.aiExecutive ?? '',
      recommendation: project.aiRecommendation ?? '',
      generatedAt: new Date(),
      error: msg,
    };
  }
}

/** Read cached AI summary from project record. Never hits the LLM. */
export function readCachedAiSummary(p: ProjectShape): CachedAiSummary | null {
  if (!p.aiSummaryAt && !p.aiExecutive && !p.aiRecommendation) return null;
  return {
    executive: p.aiExecutive ?? '',
    recommendation: p.aiRecommendation ?? '',
    generatedAt: p.aiSummaryAt ?? new Date(0),
    error: p.aiSummaryError ?? null,
  };
}

async function callLlm(
  subject: string,
  mentions: Mention[],
  score: number | null,
  category: string,
): Promise<{ executive: string; recommendation: string }> {
  const samples = mentions.slice(0, 25).map((m) => ({
    source: m.sourceName,
    sentiment: m.sentiment,
    score: m.sentimentScore,
    topic: m.topic,
    title: m.title,
    summary: m.aiSummary,
  }));

  const completion = await aiClient().chat.completions.create({
    model: aiModel(),
    ...(providerSupportsJsonMode() ? { response_format: { type: 'json_object' as const } } : {}),
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `Anda adalah analis reputasi media. Berdasarkan ringkasan mention berikut tentang subjek "${subject}" (reputation score: ${score ?? 'N/A'}/100, kategori ${category}), buat ringkasan untuk dashboard.

Output JSON dengan dua field:
{
  "executive": string 2-4 kalimat dalam Bahasa Indonesia — ringkasan eksekutif kondisi reputasi saat ini,
  "recommendation": string 2-4 kalimat — rekomendasi tindakan kongkret untuk humas/PR
}
HANYA JSON, tidak ada teks pembuka/penutup.`,
      },
      { role: 'user', content: JSON.stringify(samples) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { /* */ } }
  }
  return {
    executive: String(parsed.executive ?? '').slice(0, 1200),
    recommendation: String(parsed.recommendation ?? '').slice(0, 1200),
  };
}
