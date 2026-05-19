/**
 * Reputation score (0..100) for a project.
 *
 * If there is insufficient data we return { score: null, category: 'No data' }.
 * Threshold: a score is only emitted if there are at least 3 ANALYZED mentions.
 *
 * Otherwise score is a weighted blend:
 *   - sentiment ratio (40%)
 *   - mention volume (15%)
 *   - source credibility avg (15%)
 *   - source diversity (10%)
 *   - recency freshness (10%)
 *   - negative trend penalty (10%, subtracted)
 */
import { sourceCredibility } from '@/sources';
import type { Mention } from '@prisma/client';

export type ReputationCategory = 'Excellent' | 'Good' | 'Risky' | 'Critical' | 'No data';

export interface ReputationBreakdown {
  score: number | null;
  category: ReputationCategory;
  components: {
    sentimentRatio: number;
    volume: number;
    credibility: number;
    diversity: number;
    recency: number;
    negativeTrendPenalty: number;
  } | null;
  counts: {
    total: number;
    analyzed: number;
    positive: number;
    neutral: number;
    negative: number;
    distinctSources: number;
  };
}

const DAY = 24 * 60 * 60 * 1000;
const MIN_ANALYZED = 3;

export function computeReputation(mentions: Mention[]): ReputationBreakdown {
  const total = mentions.length;
  const analyzed = mentions.filter((m) => m.analyzedAt && m.sentiment).length;
  const positive = mentions.filter((m) => m.sentiment === 'POSITIVE').length;
  const negative = mentions.filter((m) => m.sentiment === 'NEGATIVE').length;
  const neutral = mentions.filter((m) => m.sentiment === 'NEUTRAL').length;
  const distinctSources = new Set(mentions.map((m) => m.sourceKey)).size;

  // Not enough analyzed data → no score yet.
  if (analyzed < MIN_ANALYZED) {
    return {
      score: null,
      category: 'No data',
      components: null,
      counts: { total, analyzed, positive, neutral, negative, distinctSources },
    };
  }

  // Only consider analyzed mentions for the actual score
  const aMentions = mentions.filter((m) => m.analyzedAt && m.sentiment);

  // 1. sentiment ratio (avg sentimentScore mapped to 0..1)
  const scores = aMentions.map((m) => m.sentimentScore ?? 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sentimentRatio = (avgScore + 1) / 2;

  // 2. volume (logarithmic 0..1 normalized at 200 analyzed mentions)
  const volume = Math.min(1, Math.log10(1 + analyzed) / Math.log10(201));

  // 3. credibility — weighted avg per source
  const credSum = aMentions.reduce((acc, m) => acc + sourceCredibility(m.sourceKey), 0);
  const credibility = credSum / aMentions.length;

  // 4. diversity — distinct sources among analyzed / 8 (clamped)
  const analyzedSources = new Set(aMentions.map((m) => m.sourceKey)).size;
  const diversity = Math.min(1, analyzedSources / 8);

  // 5. recency — share in last 3 days
  const now = Date.now();
  const recent = aMentions.filter((m) => {
    const d = m.publishedAt ?? m.createdAt;
    return d && now - d.getTime() < 3 * DAY;
  }).length;
  const recency = recent / aMentions.length;

  // 6. negative trend penalty
  const negRecent = aMentions.filter(
    (m) => m.sentiment === 'NEGATIVE' && (m.publishedAt ?? m.createdAt) && now - (m.publishedAt ?? m.createdAt).getTime() < 3 * DAY,
  ).length;
  const negOld = Math.max(1, negative - negRecent);
  const trendRatio = negRecent / negOld;
  const negativeTrendPenalty = Math.min(1, trendRatio / 3);

  const raw =
    0.4 * sentimentRatio +
    0.15 * volume +
    0.15 * credibility +
    0.1 * diversity +
    0.1 * recency -
    0.1 * negativeTrendPenalty;

  const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);
  const category: ReputationCategory =
    score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Risky' : 'Critical';

  return {
    score,
    category,
    components: { sentimentRatio, volume, credibility, diversity, recency, negativeTrendPenalty },
    counts: { total, analyzed, positive, neutral, negative, distinctSources },
  };
}
