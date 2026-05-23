/**
 * Aggregations for the dashboard, split into 3 focused functions so the UI can
 * fetch & render each section in parallel rather than waiting for one giant
 * snapshot query.
 *
 * Public surface:
 *   - getDashboardSummary(projectId)  → reputation + totals + project info + AI summary
 *   - getDashboardCharts(projectId)   → trends, source distribution, top topics
 *   - getDashboardRecent(projectId)   → recent mentions list + source health
 *   - getDashboardSnapshot(projectId) → combiner used by Report endpoint
 */
import { prisma } from '@/lib/prisma';
import { computeReputation } from './reputationScore';
import { readCachedAiSummary } from './aiSummary';
import type { Sentiment } from '@prisma/client';

const DAY = 24 * 60 * 60 * 1000;

function dayKey(d: Date): string {
  const utc = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return utc.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Section types
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  project: { id: string; name: string; description: string | null; lastScanAt: Date | null };
  reputation: ReturnType<typeof computeReputation>;
  totals: { mentions: number; analyzed: number; positive: number; neutral: number; negative: number };
  aiSummary?: { executive: string; recommendation: string; generatedAt: Date | null };
  aiSummaryError?: string;
}

export interface DashboardCharts {
  trend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
  mentionTrend: Array<{ date: string; count: number }>;
  sourceDistribution: Array<{ source: string; sourceKey: string; count: number }>;
  topPositiveTopics: Array<{ topic: string; count: number }>;
  topNegativeIssues: Array<{ topic: string; count: number }>;
}

export interface DashboardRecent {
  recent: Array<{
    id: string;
    title: string;
    url: string;
    sourceName: string;
    publishedAt: Date | null;
    sentiment: Sentiment | null;
    sentimentScore: number | null;
  }>;
  sourceHealth: Array<{ sourceKey: string; lastStatus: string; lastFetchedAt: Date | null; errors: number }>;
}

// Backward-compat: legacy combined shape used by /report and any caller that
// still imports DashboardSnapshot.
export interface DashboardSnapshot extends DashboardSummary, DashboardCharts, DashboardRecent {}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY — reputation + counts + project info + cached AI summary
// ─────────────────────────────────────────────────────────────────────────────

export async function getDashboardSummary(projectId: string): Promise<DashboardSummary> {
  const [project, allCount, byStatus, sample] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true, name: true, description: true, lastScanAt: true,
        aiExecutive: true, aiRecommendation: true, aiSummaryAt: true, aiSummaryError: true,
      },
    }),
    // Total mentions count (across ALL mentions, not capped at 2000 like before).
    prisma.mention.count({ where: { projectId } }),
    // Counts grouped by sentiment — analyzed only.
    prisma.mention.groupBy({
      by: ['sentiment'],
      where: { projectId, analyzedAt: { not: null } },
      _count: { _all: true },
    }),
    // Sample of recent analyzed mentions for reputation score computation.
    // Reputation needs row-level data (credibility avg, recency, trend penalty)
    // but a 500-row sample is statistically sufficient — much faster than 2000.
    prisma.mention.findMany({
      where: { projectId, analyzedAt: { not: null }, sentiment: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 500,
      select: {
        sentiment: true,
        sentimentScore: true,
        sourceKey: true,
        publishedAt: true,
        createdAt: true,
        analyzedAt: true,
      },
    }),
  ]);

  if (!project) throw new Error('Project not found or has been deleted');

  const positive = byStatus.find((r) => r.sentiment === 'POSITIVE')?._count._all ?? 0;
  const neutral = byStatus.find((r) => r.sentiment === 'NEUTRAL')?._count._all ?? 0;
  const negative = byStatus.find((r) => r.sentiment === 'NEGATIVE')?._count._all ?? 0;
  const analyzed = positive + neutral + negative;

  const totals = { mentions: allCount, analyzed, positive, neutral, negative };
  const reputation = computeReputation(sample as unknown as Parameters<typeof computeReputation>[0]);

  const cached = readCachedAiSummary(project);
  const aiSummary: DashboardSummary['aiSummary'] = cached
    ? { executive: cached.executive, recommendation: cached.recommendation, generatedAt: cached.generatedAt }
    : undefined;
  const aiSummaryError = cached?.error ?? undefined;

  return {
    project: { id: project.id, name: project.name, description: project.description, lastScanAt: project.lastScanAt },
    reputation,
    totals,
    aiSummary,
    aiSummaryError,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARTS — 14d trend, mention trend, source distribution, top topics
// ─────────────────────────────────────────────────────────────────────────────

export async function getDashboardCharts(projectId: string): Promise<DashboardCharts> {
  const today = new Date();
  const day0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const last14 = new Date(day0.getTime() - 13 * DAY);

  const [trendRows, srcRows, posRows, negRows] = await Promise.all([
    // Last 14 days mentions — only the fields needed for the trend chart.
    prisma.mention.findMany({
      where: { projectId, publishedAt: { gte: last14 } },
      orderBy: { publishedAt: 'asc' },
      select: { publishedAt: true, createdAt: true, sentiment: true },
    }),
    // Source distribution — pure SQL groupBy, no in-memory aggregation.
    prisma.mention.groupBy({
      by: ['sourceKey', 'sourceName'],
      where: { projectId },
      _count: { _all: true },
      orderBy: { _count: { sourceKey: 'desc' } },
    }),
    // Top 8 positive topics — pure SQL groupBy.
    prisma.mention.groupBy({
      by: ['topic'],
      where: { projectId, sentiment: 'POSITIVE', topic: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { topic: 'desc' } },
      take: 8,
    }),
    // Top 8 negative topics.
    prisma.mention.groupBy({
      by: ['topic'],
      where: { projectId, sentiment: 'NEGATIVE', topic: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { topic: 'desc' } },
      take: 8,
    }),
  ]);

  // Build 14-day trend (always 14 buckets — even days with zero data show up).
  const trendMap = new Map<string, { positive: number; neutral: number; negative: number; count: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(day0.getTime() - i * DAY);
    trendMap.set(dayKey(d), { positive: 0, neutral: 0, negative: 0, count: 0 });
  }
  for (const m of trendRows) {
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

  const sourceDistribution = srcRows.map((r) => ({
    source: r.sourceName,
    sourceKey: r.sourceKey,
    count: r._count._all,
  }));

  const topPositiveTopics = posRows
    .filter((r) => r.topic !== null)
    .map((r) => ({ topic: r.topic as string, count: r._count._all }));
  const topNegativeIssues = negRows
    .filter((r) => r.topic !== null)
    .map((r) => ({ topic: r.topic as string, count: r._count._all }));

  return { trend, mentionTrend, sourceDistribution, topPositiveTopics, topNegativeIssues };
}

// ─────────────────────────────────────────────────────────────────────────────
// RECENT — top 25 mentions + source health
// ─────────────────────────────────────────────────────────────────────────────

export async function getDashboardRecent(projectId: string): Promise<DashboardRecent> {
  const [recent, health] = await Promise.all([
    prisma.mention.findMany({
      where: { projectId },
      orderBy: { publishedAt: 'desc' },
      take: 25,
      select: {
        id: true,
        title: true,
        url: true,
        sourceName: true,
        publishedAt: true,
        sentiment: true,
        sentimentScore: true,
      },
    }),
    prisma.sourceStat.findMany({
      where: { projectId },
      orderBy: { lastFetchedAt: 'desc' },
      select: { sourceKey: true, lastStatus: true, lastFetchedAt: true, totalErrors: true },
    }),
  ]);

  const sourceHealth = health.map((h) => ({
    sourceKey: h.sourceKey,
    lastStatus: h.lastStatus,
    lastFetchedAt: h.lastFetchedAt,
    errors: h.totalErrors,
  }));

  return { recent, sourceHealth };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED — used by /report endpoint. Just runs the three in parallel.
// ─────────────────────────────────────────────────────────────────────────────

export async function getDashboardSnapshot(
  projectId: string,
  _opts?: { includeAi?: boolean },
): Promise<DashboardSnapshot> {
  const [summary, charts, recent] = await Promise.all([
    getDashboardSummary(projectId),
    getDashboardCharts(projectId),
    getDashboardRecent(projectId),
  ]);
  return { ...summary, ...charts, ...recent };
}
