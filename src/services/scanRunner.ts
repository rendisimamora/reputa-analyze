/**
 * End-to-end scan for a single project — with live progress tracking.
 *
 *  1. QUEUED      — scan row created
 *  2. COLLECTING  — RSS + search-page across all sources (percent driven by sourcesDone/total)
 *  3. PERSISTING  — write new mentions
 *  4. ANALYZING   — OpenAI sentiment on each new/unanalyzed mention (percent driven by analyzed/toAnalyze)
 *  5. SCORING     — reputation + alerts
 *  6. DONE        — completed
 */
import { pLimit } from '@/lib/pLimit';
import { prisma } from '@/lib/prisma';
import { ALL_SOURCES } from '@/sources';
import { collectAll } from './collector';
import { analyzeSentiment } from './sentimentAnalyzer';
import { computeReputation } from './reputationScore';
import { evaluateAlerts } from './alertEngine';
import { regenerateAiSummary } from './aiSummary';
import { env } from '@/lib/env';
import * as progress from './scanProgress';
import type { ScanTrigger } from '@prisma/client';

export interface ScanResult {
  scanRunId: string;
  newMentions: number;
  analyzed: number;
  errors: number;
  score: number | null;
}

/** Starts a scan in the background. Returns the new scanRunId immediately. */
export async function startScan(projectId: string, trigger: ScanTrigger = 'MANUAL'): Promise<string> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { keywords: true },
  });
  if (!project) throw new Error('Project not found or has been deleted');
  if (!project.keywords.length) throw new Error('Project has no keywords');

  const scan = await prisma.scanRun.create({
    data: { projectId, trigger, status: 'RUNNING' },
  });

  progress.start(projectId, scan.id, ALL_SOURCES.length);

  // Fire-and-forget. Inner code persists errors to ScanRun + scanProgress,
  // but log unexpected exceptions to console so they're visible during dev.
  void executeScan(
    project.id,
    project.name,
    project.keywords.map((k) => k.term),
    project.keywords[0]?.matchMode ?? 'ANY',
    scan.id,
  ).catch((err) => {
    console.error('[scanRunner] executeScan threw an unhandled error:', err);
  });

  return scan.id;
}

/** Synchronous wrapper used by the cron scheduler (awaits the full pipeline). */
export async function runScan(projectId: string, trigger: ScanTrigger = 'MANUAL'): Promise<ScanResult> {
  const scanRunId = await startScan(projectId, trigger);
  // poll until done
  while (true) {
    const p = progress.get(scanRunId);
    if (!p) break;
    if (p.stage === 'DONE' || p.stage === 'FAILED') break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const final = await prisma.scanRun.findUnique({ where: { id: scanRunId } });
  return {
    scanRunId,
    newMentions: final?.newMentions ?? 0,
    analyzed: final?.analyzed ?? 0,
    errors: final?.errors ?? 0,
    score: progress.get(scanRunId)?.score ?? null,
  };
}

async function executeScan(
  projectId: string,
  projectName: string,
  keywords: string[],
  matchMode: 'ANY' | 'ALL',
  scanRunId: string,
) {
  let newMentions = 0;
  let analyzed = 0;
  let errors = 0;

  console.log(`[scan ${scanRunId}] START — project="${projectName}" keywords=${JSON.stringify(keywords)}`);

  try {
    // ---- COLLECTING ----
    progress.update(scanRunId, { stage: 'COLLECTING', label: 'Mengambil data dari 16 media…' });
    console.log(`[scan ${scanRunId}] COLLECTING from ${keywords.length} keyword(s)…`);

    const report = await collectAll({
      keywords,
      matchMode,
      projectId,
      fetchFullContent: true,
      onSourceDone: (sourceKey, fetched) => {
        const cur = progress.get(scanRunId);
        if (!cur) return;
        progress.update(scanRunId, {
          sourcesDone: cur.sourcesDone + 1,
          fetched: cur.fetched + fetched,
          label: `Mengambil data — ${sourceKey} (${cur.sourcesDone + 1}/${cur.totalSources})`,
        });
      },
    });
    const fetched = report.articles.length;

    // ---- PERSISTING ----
    progress.update(scanRunId, { stage: 'PERSISTING', label: `Menyimpan ${fetched} mention…` });
    console.log(`[scan ${scanRunId}] PERSISTING ${fetched} article(s)…`);

    for (const a of report.articles) {
      try {
        const result = await prisma.mention.upsert({
          where: { projectId_urlHash: { projectId, urlHash: a.urlHash } },
          create: {
            projectId,
            sourceKey: a.source,
            sourceName: a.sourceName,
            title: a.title.slice(0, 500),
            snippet: a.snippet ?? null,
            url: a.url,
            urlHash: a.urlHash,
            contentHash: a.contentHash,
            author: a.author ?? null,
            publishedAt: a.publishedAt ?? null,
            rawContent: a.rawContent ?? null,
            matchedKeywords: a.matchedKeywords,
            collectionMethod: a.collectionMethod,
            crawlStatus: a.crawlStatus,
            crawlError: a.crawlError ?? null,
          },
          update: {
            snippet: a.snippet ?? undefined,
            rawContent: a.rawContent ?? undefined,
            matchedKeywords: a.matchedKeywords,
            crawlStatus: a.crawlStatus,
            crawlError: a.crawlError ?? null,
          },
          select: { id: true, analyzedAt: true },
        });
        if (!result.analyzedAt) newMentions++;
      } catch {
        errors++;
      }
    }

    // ---- ANALYZING ----
    const toAnalyzeRows = await prisma.mention.findMany({
      where: { projectId, analyzedAt: null, crawlStatus: { in: ['OK', 'PARTIAL'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    progress.update(scanRunId, {
      stage: 'ANALYZING',
      toAnalyze: toAnalyzeRows.length,
      analyzed: 0,
      label: `Menganalisa sentimen ${toAnalyzeRows.length} mention…`,
    });
    console.log(`[scan ${scanRunId}] ANALYZING ${toAnalyzeRows.length} mention(s) with AI…`);

    const limit = pLimit(3);
    const analyzerErrors: string[] = [];
    await Promise.all(
      toAnalyzeRows.map((m) =>
        limit(async () => {
          try {
            const result = await analyzeSentiment({
              subject: projectName,
              title: m.title,
              snippet: m.snippet,
              rawContent: m.rawContent,
              source: m.sourceName,
              publishedAt: m.publishedAt,
            });
            await prisma.mention.update({
              where: { id: m.id },
              data: {
                sentiment: result.sentiment,
                sentimentScore: result.sentimentScore,
                emotion: result.emotion,
                toxicity: result.toxicity,
                hateSpeech: result.hateSpeech,
                fakeNews: result.fakeNews,
                topic: result.topic,
                aiSummary: result.summary,
                analyzedAt: new Date(),
              },
            });
            analyzed++;
            const cur = progress.get(scanRunId);
            if (cur) {
              progress.update(scanRunId, {
                analyzed,
                label: `Menganalisa sentimen — ${analyzed}/${cur.toAnalyze}`,
              });
            }
          } catch (err) {
            errors++;
            const msg = err instanceof Error ? err.message : String(err);
            if (analyzerErrors.length < 5) analyzerErrors.push(msg);
            console.error(`[analyzer] mention ${m.id} (${m.sourceKey}) FAILED:`, msg);
          }
        }),
      ),
    );

    // Surface analyzer error to scan progress so the UI can show it
    if (analyzerErrors.length > 0 && analyzed === 0) {
      progress.update(scanRunId, {
        error: `Semua analisa sentimen gagal. Contoh error: ${analyzerErrors[0]}`,
      });
    }

    // ---- SCORING ----
    progress.update(scanRunId, { stage: 'SCORING', label: 'Menghitung reputation score…' });
    console.log(`[scan ${scanRunId}] SCORING — analyzed=${analyzed}, errors=${errors}`);
    const all = await prisma.mention.findMany({ where: { projectId } });
    const rep = computeReputation(all);
    await evaluateAlerts(projectId, rep.score);

    // Regenerate AI summary once per scan (only if we got new analyzed data)
    if (analyzed > 0) {
      progress.update(scanRunId, { label: 'Membuat AI executive summary…' });
      await regenerateAiSummary(projectId).catch((e) => {
        console.warn('[scanRunner] AI summary regen failed:', e instanceof Error ? e.message : e);
      });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { lastScanAt: new Date() },
    });

    await prisma.scanRun.update({
      where: { id: scanRunId },
      data: {
        finishedAt: new Date(),
        fetched,
        newMentions,
        analyzed,
        errors,
        status: errors === 0 ? 'SUCCESS' : errors < fetched ? 'PARTIAL' : 'FAILED',
        message: JSON.stringify({
          perSource: report.perSource,
          score: rep.score,
          category: rep.category,
        }).slice(0, 4000),
      },
    });

    progress.finish(scanRunId, rep.score);
    console.log(`[scan ${scanRunId}] DONE — score=${rep.score} (${rep.category})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[scan ${scanRunId}] FAILED at stage:`, msg, err);
    await prisma.scanRun
      .update({
        where: { id: scanRunId },
        data: { finishedAt: new Date(), status: 'FAILED', message: msg, errors: errors + 1 },
      })
      .catch(() => {});
    progress.fail(scanRunId, msg);
  }
}

export const SCAN_DEFAULTS = { concurrency: env.crawlerConcurrency };
