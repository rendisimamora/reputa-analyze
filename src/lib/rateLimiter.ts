/**
 * Per-domain rate limiter + global concurrency cap.
 *
 * - Each host gets its own queue with a minimum delay between requests.
 * - Global concurrency is capped to avoid hammering even across domains.
 * - In-process only (single Node instance). For multi-instance deployments,
 *   swap with a distributed limiter (e.g. Redis token bucket).
 */
import { env } from './env';

type Job<T> = () => Promise<T>;

interface DomainQueue {
  lastRunAt: number;
  chain: Promise<unknown>;
}

const domainQueues = new Map<string, DomainQueue>();
let globalActive = 0;
const globalWaiters: Array<() => void> = [];

function acquireGlobalSlot(): Promise<void> {
  if (globalActive < env.crawlerConcurrency) {
    globalActive++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    globalWaiters.push(() => {
      globalActive++;
      resolve();
    });
  });
}

function releaseGlobalSlot() {
  globalActive = Math.max(0, globalActive - 1);
  const next = globalWaiters.shift();
  if (next) next();
}

/**
 * Schedule a job for a given host, honoring per-host delay + global concurrency.
 * Returns the job's result.
 */
export function scheduleForHost<T>(host: string, job: Job<T>, delayMs = env.crawlerDelayMs): Promise<T> {
  const key = host.toLowerCase();
  const existing = domainQueues.get(key) ?? { lastRunAt: 0, chain: Promise.resolve() };

  const run = existing.chain.then(async () => {
    const wait = Math.max(0, existing.lastRunAt + delayMs - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    await acquireGlobalSlot();
    try {
      const result = await job();
      existing.lastRunAt = Date.now();
      return result;
    } finally {
      releaseGlobalSlot();
    }
  });

  // Make sure errors don't break the chain
  existing.chain = run.catch(() => undefined);
  domainQueues.set(key, existing);
  return run as Promise<T>;
}

/** Extract host from a URL (lowercased). */
export function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}
