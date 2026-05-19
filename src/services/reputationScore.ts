/**
 * Reputation score (0..100) for a project.
 * Weighted blend:
 *   - sentiment ratio (40%)
 *   - mention volume (15%)
 *   - source credibility avg (15%)
 *   - source diversity (10%)
 *   - recency freshness (10%)
 *   - negative trend penalty (10%, applied as subtraction)
 */
import { sourceCredibility } from '@/sources';
import type { Mention } from '@prisma/client';

export type ReputationCategory = 'Excellent' | 'Good' | 'Risky' | 'Critical';

export interface ReputationBreakdown {
  score: number;
  category: ReputationCategory;
  components: {
    sentimentRatio: number;       // 0..1
    volume: number;               // 0..1
    credibility: number;          // 0..1
    diversity: number;            // 0..1
    recency: number;              // 0..1
    negativeTrendPenalty: number; // 0..1 (subtracted)
  };
  counts: {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    distinctSources: number;
  };
}

const DAY = 24 * 60 * 60 * 1000;

export function computeReputation(mentions: Mention[]): ReputationBreakdown {
  const total = mentions.length;
  const positive = mentions.filter((m) => m.sentiment === 'POSITIVE').length;
  const negative = mentions.filter((m) => m.sentiment === 'NEGATIVE').length;
  const neutral = mentions.filter((m) => m.sentiment === 'NEUTRAL').length;

  // 1. sentiment ratio (avg sentimentScore mapped to 0..1)
  const scores = mentions.map((m) => m.sentimentScore ?? 0);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const sentimentRatio = (avgScore + 1) / 2; // -1..1 -> 0..1

  // 2. volume (logarithmic 0..1 normalized at 200 mentions)
  const volume = Math.min(1, Math.log10(1 + total) / Math.log10(201));

  // 3. credibility — weighted avg per source
  const credSum = mentions.reduce((acc, m) => acc + sourceCredibility(m.sourceKey), 0);
  const credibility = total > 0 ? credSum / total : 0.6;

  // 4. diversity — distinct sources / 8 (clamped)
  const distinctSources = new Set(mentions.map((m) => m.sourceKey)).size;
  const diversity = Math.min(1, distinctSources / 8);

  // 5. recency — share of mentions in last 3 days
  const now = Date.now();
  const recent = mentions.filter((m) => {
    const d = m.publishedAt ?? m.createdAt;
    return d && now - d.getTime() < 3 * DAY;
  }).length;
  const recency = total > 0 ? recent / total : 0.5;

  // 6. negative trend penalty: ratio of last-3d negative vs older negative
  const negRecent = mentions.filter(
    (m) => m.sentiment === 'NEGATIVE' && (m.publishedAt ?? m.createdAt) && now - (m.publishedAt ?? m.createdAt).getTime() < 3 * DAY,
  ).length;
  const negOld = Math.max(1, negative - negRecent);
  const trendRatio = negRecent / negOld; // higher = worsening
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
    counts: { total, positive, neutral, negative, distinctSources },
  };
}
