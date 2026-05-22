/**
 * Aggregations used by the dashboard + report.
 */
import { prisma } from '@/lib/prisma';
import { computeReputation } from './reputationScore';
import { readCachedAiSummary } from './aiSummary';
import type { Mention } from '@prisma/client';

export interface DashboardSnapshot {
  project: { id: string; name: string; description: string | null; lastScanAt: Date | null };
  reputation: ReturnType<typeof computeReputation>;
  totals: { mentions: number; analyzed: number; positive: number; neutral: number; negative: number };
  trend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
  mentionTrend: Array<{ date: string; count: number }>;
  sourceDistribution: Array<{ source: string; sourceKey: string; count: number }>;
  topPositiveTopics: Array<{ topic: string; count: number }>;
  topNegativeIssues: Array<{ topic: string; count: number }>;
  sourceHealth: Array<{ sourceKey: string; lastStatus: string; lastFetchedAt: Date | null; errors: number }>;
  recent: Array<{
    id: string;
    title: string;
    url: string;
    sourceName: string;
    publishedAt: Date | null;
    sentiment: import('@prisma/client').Sentiment | null;
    sentimentScore: number | null;
  }>;
  aiSummary?: { executive: string; recommendation: string; generatedAt: Date | null };
  aiSummaryError?: string;
}

const DAY = 24 * 60 * 60 * 1000;
function dayKey(d: Date): string {
  const utc = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return utc.toISOString().slice(0, 10);
}

export async function getDashboardSnapshot(projectId: string, opts?: { includeAi?: boolean }): Promise<DashboardSnapshot> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      lastScanAt: true,
      // Needed by readCachedAiSummary
      aiExecutive: true,
      aiRecommendation: true,
      aiSummaryAt: true,
      aiSummaryError: true,
    },
  });
  if (!project) throw new Error('Project not found or has been deleted');

  // Heavy query — 2000 rows. We project to ONLY the fields the dashboard
  // aggregations + recent list need. Dropping rawContent alone saves the
  // largest single column (full article bodies, can be many KB each).
  const mentions = await prisma.mention.findMany({
    where: { projectId },
    orderBy: { publishedAt: 'desc' },
    take: 2000,
    select: {
      id: true,
      title: true,
      url: true,
      sourceKey: true,
      sourceName: true,
      publishedAt: true,
      createdAt: true,
      sentiment: true,
      sentimentScore: true,
      topic: true,
      analyzedAt: true,
    },
  });

  const reputation = computeReputation(mentions as unknown as Parameters<typeof computeReputation>[0]);

  const totals = {
    mentions: mentions.length,
    analyzed: mentions.filter((m) => m.analyzedAt && m.sentiment).length,
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
  const posTopics = topicCounts(mentions.filter((m) => m.sentiment === 'POSITIVE') as Parameters<typeof topicCounts>[0]);
  const negTopics = topicCounts(mentions.filter((m) => m.sentiment === 'NEGATIVE') as Parameters<typeof topicCounts>[0]);

  // source health — STRICTLY per-project (no cross-project leakage)
  const health = await prisma.sourceStat.findMany({
    where: { projectId },
    orderBy: { lastFetchedAt: 'desc' },
  });
  const sourceHealth = health.map((h) => ({
    sourceKey: h.sourceKey,
    lastStatus: h.lastStatus,
    lastFetchedAt: h.lastFetchedAt,
    errors: h.totalErrors,
  }));

  // Project recent mentions to only the fields the UI renders.
  const recent = mentions.slice(0, 25).map((m) => ({
    id: m.id,
    title: m.title,
    url: m.url,
    sourceName: m.sourceName,
    publishedAt: m.publishedAt,
    sentiment: m.sentiment,
    sentimentScore: m.sentimentScore,
  }));

  // Read cached AI summary from project record — NEVER calls the LLM here.
  // It is regenerated by scanRunner / reanalyze / explicit /summary/regenerate endpoint.
  const cached = readCachedAiSummary(project);
  const aiSummary: DashboardSnapshot['aiSummary'] =
    cached ? { executive: cached.executive, recommendation: cached.recommendation, generatedAt: cached.generatedAt } : undefined;
  const aiSummaryError = cached?.error ?? undefined;

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
    aiSummaryError,
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

