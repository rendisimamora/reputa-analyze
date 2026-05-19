/**
 * Evaluate alerts after a scan. Writes Alert rows to DB.
 * Rules:
 *  - NEGATIVE_SPIKE: negative mention count last 24h > 2x previous 24h, minimum 3.
 *  - HIGH_TOXICITY: avg toxicity in last 24h > 0.6 with >=3 samples.
 *  - REPUTATION_DROP: score dropped >= 15 points vs previous scan.
 *  - CREDIBLE_NEGATIVE: >=2 mentions from sources with credibility >= 0.85 with NEGATIVE sentiment.
 *  - MULTI_SOURCE_NEGATIVE: same project sees negative sentiment in >=4 distinct sources within 48h.
 */
import { prisma } from '@/lib/prisma';
import { sourceCredibility } from '@/sources';
import type { AlertSeverity, AlertType, Mention } from '@prisma/client';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface AlertDraft {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
}

export async function evaluateAlerts(projectId: string, currentScore: number) {
  const mentions = await prisma.mention.findMany({
    where: { projectId },
    orderBy: { publishedAt: 'desc' },
    take: 1000,
  });

  const drafts: AlertDraft[] = [];
  const now = Date.now();

  // Group by 24h window
  const last24 = mentions.filter((m) => withinHours(m, now, 24));
  const prev24 = mentions.filter((m) => betweenHours(m, now, 24, 48));

  const neg24 = last24.filter((m) => m.sentiment === 'NEGATIVE').length;
  const negPrev = prev24.filter((m) => m.sentiment === 'NEGATIVE').length;

  if (neg24 >= 3 && neg24 > 2 * Math.max(1, negPrev)) {
    drafts.push({
      type: 'NEGATIVE_SPIKE',
      severity: neg24 > 10 ? 'HIGH' : 'MEDIUM',
      title: 'Lonjakan sentimen negatif (24 jam)',
      message: `${neg24} mention negatif dalam 24 jam terakhir vs ${negPrev} pada 24 jam sebelumnya.`,
      payload: { neg24, negPrev },
    });
  }

  const tox24 = last24.filter((m) => (m.toxicity ?? 0) > 0).map((m) => m.toxicity ?? 0);
  if (tox24.length >= 3) {
    const avgTox = tox24.reduce((a, b) => a + b, 0) / tox24.length;
    if (avgTox > 0.6) {
      drafts.push({
        type: 'HIGH_TOXICITY',
        severity: avgTox > 0.8 ? 'CRITICAL' : 'HIGH',
        title: 'Tingkat toksisitas tinggi',
        message: `Rata-rata toxicity ${(avgTox * 100).toFixed(0)}% dari ${tox24.length} mention 24 jam terakhir.`,
        payload: { avgTox, sample: tox24.length },
      });
    }
  }

  // Reputation drop vs latest historical report
  const lastReport = await prisma.report.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  if (lastReport) {
    const prevScore = (lastReport.payload as { score?: number } | null)?.score;
    if (typeof prevScore === 'number' && prevScore - currentScore >= 15) {
      drafts.push({
        type: 'REPUTATION_DROP',
        severity: 'HIGH',
        title: 'Reputation score turun signifikan',
        message: `Score turun dari ${prevScore} ke ${currentScore} (${prevScore - currentScore} poin).`,
        payload: { previousScore: prevScore, currentScore },
      });
    }
  }

  // Credible negative
  const credibleNeg = last24.filter(
    (m) => m.sentiment === 'NEGATIVE' && sourceCredibility(m.sourceKey) >= 0.85,
  );
  if (credibleNeg.length >= 2) {
    drafts.push({
      type: 'CREDIBLE_NEGATIVE',
      severity: 'HIGH',
      title: 'Media kredibel memberitakan negatif',
      message: `${credibleNeg.length} mention negatif dari media dengan kredibilitas tinggi (${[...new Set(credibleNeg.map((m) => m.sourceName))].join(', ')}).`,
      payload: { count: credibleNeg.length, sources: [...new Set(credibleNeg.map((m) => m.sourceKey))] },
    });
  }

  // Multi-source negative within 48h
  const neg48 = mentions.filter((m) => m.sentiment === 'NEGATIVE' && withinHours(m, now, 48));
  const distinctNegSources = new Set(neg48.map((m) => m.sourceKey)).size;
  if (distinctNegSources >= 4) {
    drafts.push({
      type: 'MULTI_SOURCE_NEGATIVE',
      severity: 'HIGH',
      title: 'Isu negatif tersebar di banyak media',
      message: `${distinctNegSources} sumber berbeda memberitakan negatif dalam 48 jam terakhir.`,
      payload: { distinctNegSources },
    });
  }

  // Persist — dedupe by (type, title) within the last hour
  for (const d of drafts) {
    const existing = await prisma.alert.findFirst({
      where: {
        projectId,
        type: d.type,
        title: d.title,
        createdAt: { gte: new Date(now - HOUR) },
      },
    });
    if (existing) continue;
    await prisma.alert.create({
      data: {
        projectId,
        type: d.type,
        severity: d.severity,
        title: d.title,
        message: d.message,
        payload: (d.payload ?? {}) as object,
      },
    });
  }

  return drafts.length;
}

function withinHours(m: Mention, nowMs: number, hours: number): boolean {
  const d = m.publishedAt ?? m.createdAt;
  if (!d) return false;
  const diff = nowMs - d.getTime();
  return diff >= 0 && diff < hours * HOUR;
}

function betweenHours(m: Mention, nowMs: number, fromH: number, toH: number): boolean {
  const d = m.publishedAt ?? m.createdAt;
  if (!d) return false;
  const diff = nowMs - d.getTime();
  return diff >= fromH * HOUR && diff < toH * HOUR;
}
