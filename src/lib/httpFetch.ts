/**
 * Polite HTTP fetcher: respects robots.txt, rate-limits per host,
 * retries with exponential backoff on transient errors, caches GETs briefly.
 *
 * Always returns a discriminated union — never throws. Callers must inspect `ok`.
 */
import { env } from './env';
import { canCrawl, robotsDelayMs } from './robotsChecker';
import { hostOf, scheduleForHost } from './rateLimiter';
import { fetchCache } from './cache';
import { logCrawl } from './crawlLogger';
import type { CollectionMethod, CrawlStatusType } from '@/types';

export interface FetchOk {
  ok: true;
  status: number;
  url: string;
  body: string;
  durationMs: number;
  fromCache: boolean;
}

export interface FetchErr {
  ok: false;
  status: number | null;
  url: string;
  error: string;
  reason: CrawlStatusType;
  durationMs: number;
}

export type FetchResult = FetchOk | FetchErr;

interface FetchOptions {
  method?: CollectionMethod;
  sourceKey: string;
  projectId?: string;
  cache?: boolean;
  timeoutMs?: number;
  accept?: string;
  /** If true (default), check robots.txt before fetching. */
  honorRobots?: boolean;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function politeFetch(url: string, opts: FetchOptions): Promise<FetchResult> {
  const start = Date.now();
  const method = opts.method ?? 'ARTICLE_SCRAPE';
  const useCache = opts.cache !== false;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const honorRobots = opts.honorRobots !== false;

  // 1. cache
  if (useCache) {
    const cached = fetchCache.get(url);
    if (cached !== undefined) {
      return { ok: true, status: 200, url, body: cached, durationMs: 0, fromCache: true };
    }
  }

  // 2. robots
  if (honorRobots) {
    const robots = await canCrawl(url);
    if (!robots.allowed) {
      await logCrawl({
        projectId: opts.projectId,
        sourceKey: opts.sourceKey,
        method,
        url,
        status: 'RESTRICTED',
        message: robots.reason,
        durationMs: Date.now() - start,
      });
      return {
        ok: false,
        status: null,
        url,
        error: robots.reason ?? 'Disallowed by robots.txt',
        reason: 'RESTRICTED',
        durationMs: Date.now() - start,
      };
    }
  }

  // 3. rate-limited + retried fetch
  const host = hostOf(url);
  const robotsDelay = honorRobots ? await robotsDelayMs(url) : 0;
  const delay = Math.max(env.crawlerDelayMs, robotsDelay);

  const attemptOnce = async (): Promise<FetchResult> => {
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': env.crawlerUserAgent,
          Accept: opts.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id,en;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          status: res.status,
          url,
          error: `HTTP ${res.status} — access restricted`,
          reason: 'RESTRICTED',
          durationMs: Date.now() - t0,
        };
      }
      if (res.status === 429) {
        return {
          ok: false,
          status: 429,
          url,
          error: 'Rate limited by upstream',
          reason: 'RATE_LIMITED',
          durationMs: Date.now() - t0,
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          url,
          error: `HTTP ${res.status}`,
          reason: RETRYABLE_STATUS.has(res.status) ? 'ERROR' : 'ERROR',
          durationMs: Date.now() - t0,
        };
      }

      const body = await res.text();
      if (useCache) fetchCache.set(url, body);
      return {
        ok: true,
        status: res.status,
        url,
        body,
        durationMs: Date.now() - t0,
        fromCache: false,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        status: null,
        url,
        error: msg,
        reason: 'ERROR',
        durationMs: Date.now() - t0,
      };
    }
  };

  const result = await scheduleForHost(host, async () => {
    let last: FetchResult | null = null;
    for (let attempt = 0; attempt <= env.crawlerMaxRetries; attempt++) {
      last = await attemptOnce();
      if (last.ok) return last;
      // only retry transient
      const httpRetry = last.status !== null && RETRYABLE_STATUS.has(last.status);
      const transient = last.reason === 'RATE_LIMITED' || httpRetry;
      if (!transient) return last;
      // exponential backoff
      const backoff = 500 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, backoff));
    }
    return last!;
  }, delay);

  await logCrawl({
    projectId: opts.projectId,
    sourceKey: opts.sourceKey,
    method,
    url,
    status: result.ok ? 'OK' : result.reason,
    httpStatus: result.ok ? result.status : result.status ?? undefined,
    message: result.ok ? undefined : result.error,
    durationMs: Date.now() - start,
  });

  return result;
}
