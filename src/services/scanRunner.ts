/**
 * End-to-end scan for a single project — with live progress tracking.
 *
 * ARCHITECTURE (post-refactor):
 *   Next.js API   →  enqueueScan()        ← only creates a QUEUED ScanRun row.
 *   Scheduler VM  →  claimAndExecuteOne() ← atomically claims & runs the pipeline.
 *
 * Pipeline stages (mirrored in scanProgress.ts):
 *   1. QUEUED      — row inserted, waiting for a worker to claim
 *   2. COLLECTING  — RSS + search-page across all sources
 *   3. PERSISTING  — write new mentions to DB
 *   4. ANALYZING   — OpenAI sentiment on new/unanalyzed mentions
 *   5. SCORING     — reputation + alerts + AI summary
 *   6. DONE
 */
import { pLimit } from '@/lib/pLimit';
import { prisma } from '@/lib/prisma';
import { ALL_SOURCES } from '@/sources';
import { collectAll } from './collector';
import { analyzeSentiment } from './sentimentAnalyzer';
import { computeReputation } from './reputationScore';
import { evaluateAlerts } from './alertEngine';
import { regenerateAiSummary } from './aiSummary';
import { regenerateInsightContent } from './insightContent';
import { regenerateInsightKeyword } from './insightKeyword';
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

/**
 * Enqueue a scan. Inserts a QUEUED ScanRun row and returns its id IMMEDIATELY.
 * The actual work is picked up by the scheduler worker (see src/scheduler/runner.ts).
 *
 * This is the ONLY function Next.js routes should call.
 */
export async function enqueueScan(projectId: string, trigger: ScanTrigger = 'MANUAL'): Promise<string> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { keywords: true },
  });
  if (!project) throw new Error('Project not found or has been deleted');
  if (!project.keywords.length) throw new Error('Project has no keywords');

  // De-dupe: if there's already an unclaimed QUEUED row for this project, return it.
  const existing = await prisma.scanRun.findFirst({
    where: { projectId, status: 'QUEUED', claimedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (existing) return existing.id;

  const scan = await prisma.scanRun.create({
    data: {
      projectId,
      trigger,
      status: 'QUEUED',
      progressJson: {
        stage: 'QUEUED',
        percent: 0,
        label: 'Menunggu worker…',
        totalSources: ALL_SOURCES.length,
        sourcesDone: 0,
        fetched: 0,
        toAnalyze: 0,
        analyzed: 0,
      },
    },
  });
  return scan.id;
}

/**
 * Atomically claim the oldest QUEUED scan, then execute it.
 * Returns the result, or null if there's nothing to claim.
 *
 * Called by the standalone scheduler process (PM2 on VM). NEVER call this from Next.js.
 */
export async function claimAndExecuteOne(): Promise<ScanResult | null> {
  // Pick the oldest unclaimed QUEUED row.
  const candidate = await prisma.scanRun.findFirst({
    where: { status: 'QUEUED', claimedAt: null },
    orderBy: { startedAt: 'asc' },
    select: { id: true },
  });
  if (!candidate) return null;

  // Atomic claim: only succeeds if the row is STILL QUEUED + unclaimed.
  // If another worker beat us, count will be 0 — we just bail and try again next tick.
  const claimed = await prisma.scanRun.updateMany({
    where: { id: candidate.id, status: 'QUEUED', claimedAt: null },
    data: { status: 'RUNNING', claimedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  return executeScan(candidate.id);
}

/**
 * Execute one already-claimed scan (status: RUNNING). Called by the worker.
 */
export async function executeScan(scanRunId: string): Promise<ScanResult> {
  const row = await prisma.scanRun.findUnique({ where: { id: scanRunId } });
  if (!row) throw new Error(`ScanRun ${scanRunId} not found`);

  const project = await prisma.project.findFirst({
    where: { id: row.projectId, deletedAt: null },
    include: { keywords: true },
  });
  if (!project) throw new Error(`Project ${row.projectId} not found`);
  if (!project.keywords.length) throw new Error('Project has no keywords');

  await progress.start(project.id, scanRunId, ALL_SOURCES.length);

  let newMentions = 0;
  let analyzed = 0;
  let errors = 0;
  let score: number | null = null;

  const keywords = project.keywords.map((k) => k.term);
  const matchMode = project.keywords[0]?.matchMode ?? 'ANY';

  console.log(`[scan ${scanRunId}] START — project="${project.name}" keywords=${JSON.stringify(keywords)}`);

  try {
    // ---- COLLECTING ----
    console.log(`[scan ${scanRunId}] COLLECTING from ${ALL_SOURCES.length} sources…`);
    await progress.update(scanRunId, { stage: 'COLLECTING', label: 'Mengambil data dari 16 media…' });

    const report = await collectAll({
      keywords,
      matchMode,
      projectId: project.id,
      fetchFullContent: true,
      onSourceDone: (sourceKey, fetched, error) => {
        const tag = error ? `ERR(${error.slice(0, 60)})` : `+${fetched}`;
        console.log(`[scan ${scanRunId}]   source ${sourceKey} done — ${tag}`);
        // Fire-and-forget DB write — collector doesn't await this anyway.
        void (async () => {
          const cur = await progress.get(scanRunId);
          if (!cur) return;
          await progress.update(scanRunId, {
            sourcesDone: cur.sourcesDone + 1,
            fetched: cur.fetched + fetched,
            label: `Mengambil data — ${sourceKey} (${cur.sourcesDone + 1}/${cur.totalSources})`,
          });
        })();
      },
    });
    const fetched = report.articles.length;
    console.log(`[scan ${scanRunId}] COLLECTING done — ${fetched} unique article(s) after dedupe`);

    // ---- PERSISTING ----
    console.log(`[scan ${scanRunId}] PERSISTING ${fetched} article(s)…`);
    await progress.update(scanRunId, { stage: 'PERSISTING', label: `Menyimpan ${fetched} mention…` });

    for (const a of report.articles) {
      try {
        const result = await prisma.mention.upsert({
          where: { projectId_urlHash: { projectId: project.id, urlHash: a.urlHash } },
          create: {
            projectId: project.id,
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
      where: { projectId: project.id, analyzedAt: null, crawlStatus: { in: ['OK', 'PARTIAL'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    console.log(`[scan ${scanRunId}] ANALYZING ${toAnalyzeRows.length} mention(s) with AI…`);
    await progress.update(scanRunId, {
      stage: 'ANALYZING',
      toAnalyze: toAnalyzeRows.length,
      analyzed: 0,
      label: `Menganalisa sentimen ${toAnalyzeRows.length} mention…`,
    });

    const limit = pLimit(3);
    const analyzerErrors: string[] = [];
    await Promise.all(
      toAnalyzeRows.map((m) =>
        limit(async () => {
          try {
            const result = await analyzeSentiment({
              subject: project.name,
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
            const cur = await progress.get(scanRunId);
            if (cur) {
              await progress.update(scanRunId, {
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

    if (analyzerErrors.length > 0 && analyzed === 0) {
      await progress.update(scanRunId, {
        error: `Semua analisa sentimen gagal. Contoh error: ${analyzerErrors[0]}`,
      });
    }

    // ---- SCORING ----
    console.log(`[scan ${scanRunId}] SCORING — analyzed=${analyzed}, errors=${errors}`);
    await progress.update(scanRunId, { stage: 'SCORING', label: 'Menghitung reputation score…' });
    const all = await prisma.mention.findMany({ where: { projectId: project.id } });
    const rep = computeReputation(all);
    await evaluateAlerts(project.id, rep.score);
    score = rep.score;

    if (analyzed > 0) {
      await progress.update(scanRunId, { label: 'Membuat AI executive summary…' });
      // Run summary + both insights in parallel — they all hit the LLM independently
      // and we don't want to wait for one before kicking off the next.
      await Promise.allSettled([
        regenerateAiSummary(project.id).catch((e) => {
          console.warn('[scanRunner] AI summary regen failed:', e instanceof Error ? e.message : e);
        }),
        regenerateInsightContent(project.id).catch((e) => {
          console.warn('[scanRunner] insight content regen failed:', e instanceof Error ? e.message : e);
        }),
        regenerateInsightKeyword(project.id).catch((e) => {
          console.warn('[scanRunner] insight keyword regen failed:', e instanceof Error ? e.message : e);
        }),
      ]);
    }

    await prisma.project.update({
      where: { id: project.id },
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

    await progress.finish(scanRunId, rep.score);
    console.log(`[scan ${scanRunId}] DONE — score=${rep.score} (${rep.category})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[scan ${scanRunId}] FAILED:`, msg);
    await prisma.scanRun
      .update({
        where: { id: scanRunId },
        data: { finishedAt: new Date(), status: 'FAILED', message: msg, errors: errors + 1 },
      })
      .catch(() => {});
    await progress.fail(scanRunId, msg);
  }

  return { scanRunId, newMentions, analyzed, errors, score };
}

export const SCAN_DEFAULTS = { concurrency: env.crawlerConcurrency };
