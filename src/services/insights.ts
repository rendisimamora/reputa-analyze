/**
 * Aggregations used by the dashboard + report.
 */
import { prisma } from '@/lib/prisma';
import { computeReputation } from './reputationScore';
import { openai } from '@/lib/openai';
import { env } from '@/lib/env';
import type { Mention } from '@prisma/client';

export interface DashboardSnapshot {
  project: { id: string; name: string; description: string | null; lastScanAt: Date | null };
  reputation: ReturnType<typeof computeReputation>;
  totals: { mentions: number; positive: number; neutral: number; negative: number };
  trend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
  mentionTrend: Array<{ date: string; count: number }>;
  sourceDistribution: Array<{ source: string; sourceKey: string; count: number }>;
  topPositiveTopics: Array<{ topic: string; count: number }>;
  topNegativeIssues: Array<{ topic: string; count: number }>;
  sourceHealth: Array<{ sourceKey: string; lastStatus: string; lastFetchedAt: Date | null; errors: number }>;
  recent: Mention[];
  aiSummary?: { executive: string; recommendation: string };
}

const DAY = 24 * 60 * 60 * 1000;
function dayKey(d: Date): string {
  const utc = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return utc.toISOString().slice(0, 10);
}

export async function getDashboardSnapshot(projectId: string, opts?: { includeAi?: boolean }): Promise<DashboardSnapshot> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  const mentions = await prisma.mention.findMany({
    where: { projectId },
    orderBy: { publishedAt: 'desc' },
    take: 2000,
  });

  const reputation = computeReputation(mentions);

  const totals = {
    mentions: mentions.length,
    positive: mentions.filter((m) => m.sentiment === 'POSITIVE').length,
    neutral: mentions.filter((m) => m.sentiment === 'NEUTRAL').length,
    negative: mentions.filter((m) => m.sentiment === 'NEGATIVE').length,
  };

  // 14-day trend
  const days = 14;
  const today = new Date();
  const days0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const trendMap = new Map<string, { positive: number; neutral: number; negative: number; count: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(days0.getTime() - i * DAY);
    trendMap.set(dayKey(d), { positive: 0, neutral: 0, negative: 0, count: 0 });
  }
  for (const m of mentions) {
    const d = m.publishedAt ?? m.createdAt;
    if (!d) continue;
    const k = dayKey(d);
    const slot = trendMap.get(k);
    if (!slot) continue;
    slot.count++;
    if (m.sentiment === 'POSITIVE') slot.positive++;
    else if (m.sentiment === 'NEGATIVE') slot.negative++;
    else slot.neutral++;
  }
  const trend = [...trendMap.entries()].map(([date, v]) => ({ date, ...v }));
  const mentionTrend = trend.map((t) => ({ date: t.date, count: t.positive + t.neutral + t.negative }));

  // source distribution
  const srcMap = new Map<string, { source: string; sourceKey: string; count: number }>();
  for (const m of mentions) {
    const e = srcMap.get(m.sourceKey) ?? { source: m.sourceName, sourceKey: m.sourceKey, count: 0 };
    e.count++;
    srcMap.set(m.sourceKey, e);
  }
  const sourceDistribution = [...srcMap.values()].sort((a, b) => b.count - a.count);

  // topics
  const posTopics = topicCounts(mentions.filter((m) => m.sentiment === 'POSITIVE'));
  const negTopics = topicCounts(mentions.filter((m) => m.sentiment === 'NEGATIVE'));

  // source health
  const health = await prisma.sourceStat.findMany({
    where: { OR: [{ projectId }, { projectId: null }] },
    orderBy: { lastFetchedAt: 'desc' },
  });
  const sourceHealth = health.map((h) => ({
    sourceKey: h.sourceKey,
    lastStatus: h.lastStatus,
    lastFetchedAt: h.lastFetchedAt,
    errors: h.totalErrors,
  }));

  const recent = mentions.slice(0, 25);

  let aiSummary: DashboardSnapshot['aiSummary'];
  if (opts?.includeAi && env.openaiKey) {
    aiSummary = await buildAiSummary(project.name, mentions.slice(0, 60), reputation.score, reputation.category);
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      lastScanAt: project.lastScanAt,
    },
    reputation,
    totals,
    trend,
    mentionTrend,
    sourceDistribution,
    topPositiveTopics: posTopics,
    topNegativeIssues: negTopics,
    sourceHealth,
    recent,
    aiSummary,
  };
}

function topicCounts(mentions: Mention[]): Array<{ topic: string; count: number }> {
  const map = new Map<string, number>();
  for (const m of mentions) {
    const t = (m.topic ?? '').trim();
    if (!t) continue;
    map.set(t, (map.get(t) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

async function buildAiSummary(
  subject: string,
  mentions: Mention[],
  score: number,
  category: string,
): Promise<{ executive: string; recommendation: string }> {
  if (!mentions.length) {
    return {
      executive: `Belum ada mention untuk "${subject}".`,
      recommendation: 'Jalankan scan untuk memulai monitoring.',
    };
  }
  const samples = mentions.slice(0, 25).map((m) => ({
    source: m.sourceName,
    sentiment: m.sentiment,
    score: m.sentimentScore,
    topic: m.topic,
    title: m.title,
    summary: m.aiSummary,
  }));

  const completion = await openai().chat.completions.create({
    model: env.openaiModel,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `Anda adalah analis reputasi media. Berdasarkan ringkasan mention berikut tentang subjek "${subject}" (reputation score: ${score}/${100}, kategori ${category}), buat ringkasan untuk dashboard.

Output JSON dengan dua field:
{
  "executive": string 2-4 kalimat dalam Bahasa Indonesia — ringkasan eksekutif kondisi reputasi saat ini,
  "recommendation": string 2-4 kalimat — rekomendasi tindakan kongkret untuk humas/PR
}`,
      },
      { role: 'user', content: JSON.stringify(samples) },
    ],
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as Record<string, unknown>;
    return {
      executive: String(parsed.executive ?? '').slice(0, 1200),
      recommendation: String(parsed.recommendation ?? '').slice(0, 1200),
    };
  } catch {
    return { executive: '', recommendation: '' };
  }
}
