/**
 * Centralized env access (with safe defaults).
 * Avoids scattered `process.env.X || '...'` across the codebase.
 */

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  openaiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  sessionPassword:
    process.env.SESSION_PASSWORD ?? 'change-me-to-a-random-32+character-string-please',
  crawlerUserAgent:
    process.env.CRAWLER_USER_AGENT ??
    'ReputaScanBot/1.0 (+https://reputascan.id/bot; contact@reputascan.id)',
  crawlerDelayMs: Number(process.env.CRAWLER_DELAY_MS ?? 2500),
  crawlerConcurrency: Number(process.env.CRAWLER_CONCURRENCY ?? 4),
  crawlerMaxRetries: Number(process.env.CRAWLER_MAX_RETRIES ?? 2),
  scanCron: process.env.SCAN_CRON ?? '*/30 * * * *',
  maxArticlesPerSource: Number(process.env.MAX_ARTICLES_PER_SOURCE ?? 40),
};

export function assertServerEnv() {
  const required: Array<[string, string]> = [
    ['DATABASE_URL', env.databaseUrl],
    ['OPENAI_API_KEY', env.openaiKey],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
