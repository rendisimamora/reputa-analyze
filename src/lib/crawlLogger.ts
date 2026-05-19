/**
 * Persist crawl logs + update source health.
 * Best-effort: never throws.
 */
import { prisma } from './prisma';
import type { CollectionMethod, CrawlStatusType } from '@/types';

interface LogParams {
  projectId?: string;
  sourceKey: string;
  method: CollectionMethod;
  url: string;
  status: CrawlStatusType;
  httpStatus?: number;
  message?: string;
  durationMs?: number;
}

export async function logCrawl(params: LogParams): Promise<void> {
  try {
    await prisma.crawlLog.create({
      data: {
        projectId: params.projectId,
        sourceKey: params.sourceKey,
        method: params.method,
        url: params.url,
        status: params.status,
        httpStatus: params.httpStatus,
        message: params.message?.slice(0, 4000),
        durationMs: params.durationMs,
      },
    });

    await prisma.sourceStat.upsert({
      where: {
        projectId_sourceKey: {
          projectId: params.projectId ?? '',
          sourceKey: params.sourceKey,
        },
      },
      create: {
        projectId: params.projectId ?? null,
        sourceKey: params.sourceKey,
        lastFetchedAt: new Date(),
        lastStatus: params.status,
        totalFetched: 1,
        totalErrors: params.status === 'OK' ? 0 : 1,
        lastError: params.status === 'OK' ? null : params.message,
      },
      update: {
        lastFetchedAt: new Date(),
        lastStatus: params.status,
        totalFetched: { increment: 1 },
        totalErrors: params.status === 'OK' ? undefined : { increment: 1 },
        lastError: params.status === 'OK' ? null : params.message?.slice(0, 2000),
      },
    });
  } catch {
    // best-effort logging — swallow errors so the crawler never crashes on logging
  }
}
