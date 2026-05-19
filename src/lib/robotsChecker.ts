/**
 * robots.txt checker with in-memory cache.
 * - Fetches /robots.txt for each origin on first use.
 * - Caches the parsed result for 6 hours.
 * - Errors are treated conservatively: if robots.txt can't be parsed,
 *   we DEFAULT to DISALLOW (safer to skip than to scrape).
 */
import robotsParser from 'robots-parser';
import { env } from './env';

interface CachedRobots {
  expiresAt: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parser: any;
  fetchOk: boolean;
}

const cache = new Map<string, CachedRobots>();
const TTL_MS = 6 * 60 * 60 * 1000;

async function loadRobots(origin: string): Promise<CachedRobots> {
  const cached = cache.get(origin);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const robotsUrl = `${origin}/robots.txt`;
  try {
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': env.crawlerUserAgent, Accept: 'text/plain, */*' },
      // robots.txt should be quick
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // 4xx / 5xx — assume no robots = allow (RFC: missing robots.txt = allowed)
      // but signal that we didn't actually verify.
      const entry: CachedRobots = {
        expiresAt: Date.now() + TTL_MS,
        parser: robotsParser(robotsUrl, ''),
        fetchOk: res.status === 404 || res.status === 410,
      };
      cache.set(origin, entry);
      return entry;
    }
    const text = await res.text();
    const entry: CachedRobots = {
      expiresAt: Date.now() + TTL_MS,
      parser: robotsParser(robotsUrl, text),
      fetchOk: true,
    };
    cache.set(origin, entry);
    return entry;
  } catch {
    // Network error — be safe and assume disallow for this period.
    const entry: CachedRobots = {
      expiresAt: Date.now() + 5 * 60 * 1000, // shorter TTL on failure
      parser: robotsParser(robotsUrl, 'User-agent: *\nDisallow: /'),
      fetchOk: false,
    };
    cache.set(origin, entry);
    return entry;
  }
}

/** Returns true if our crawler is allowed to fetch this URL. */
export async function canCrawl(url: string): Promise<{ allowed: boolean; reason?: string }> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return { allowed: false, reason: 'Invalid URL' };
  }
  const { parser } = await loadRobots(origin);
  const allowed = parser.isAllowed(url, env.crawlerUserAgent) ?? true;
  return allowed ? { allowed: true } : { allowed: false, reason: 'Disallowed by robots.txt' };
}

/** Suggested crawl delay (seconds) from robots.txt — used to enlarge per-host delays. */
export async function robotsDelayMs(url: string): Promise<number> {
  try {
    const origin = new URL(url).origin;
    const { parser } = await loadRobots(origin);
    const d = parser.getCrawlDelay(env.crawlerUserAgent);
    return typeof d === 'number' && d > 0 ? d * 1000 : 0;
  } catch {
    return 0;
  }
}
