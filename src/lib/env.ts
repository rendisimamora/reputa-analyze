/**
 * Centralized env access (with safe defaults).
 */

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? '',

  // ----- AI provider config -----
  // AI_PROVIDER: "openai" | "groq" | "ollama" | "openrouter"
  aiProvider: process.env.AI_PROVIDER ?? 'openai',
  // Optional explicit model override; if empty, provider default is used.
  aiModel: process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? '',

  openaiKey: process.env.OPENAI_API_KEY ?? '',
  groqKey: process.env.GROQ_API_KEY ?? '',
  openrouterKey: process.env.OPENROUTER_API_KEY ?? '',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',

  // ----- Auth -----
  sessionPassword:
    process.env.SESSION_PASSWORD ?? 'change-me-to-a-random-32+character-string-please',
  // JWT signing secret. WAJIB di-set di production (min 32 chars).
  jwtSecret: process.env.JWT_SECRET ?? '',
  // Token lifetime in seconds. Default 7 days.
  jwtTtlSeconds: Number(process.env.JWT_TTL_SECONDS ?? 60 * 60 * 24 * 7),

  // ----- Crawler -----
  crawlerUserAgent:
    process.env.CRAWLER_USER_AGENT ??
    'ReputaScanBot/1.0 (+https://reputascan.id/bot; contact@reputascan.id)',
  crawlerDelayMs: Number(process.env.CRAWLER_DELAY_MS ?? 2500),
  crawlerConcurrency: Number(process.env.CRAWLER_CONCURRENCY ?? 4),
  crawlerMaxRetries: Number(process.env.CRAWLER_MAX_RETRIES ?? 2),
  scanCron: process.env.SCAN_CRON ?? '*/30 * * * *',
  maxArticlesPerSource: Number(process.env.MAX_ARTICLES_PER_SOURCE ?? 40),

  // Legacy alias (kept for older code paths)
  get openaiModel(): string {
    return this.aiModel || 'gpt-4o-mini';
  },
};

export function assertServerEnv() {
  const missing: string[] = [];
  if (!env.databaseUrl) missing.push('DATABASE_URL');

  // At least one provider must be configured
  const providerOk =
    (env.aiProvider === 'openai' && env.openaiKey) ||
    (env.aiProvider === 'groq' && env.groqKey) ||
    (env.aiProvider === 'openrouter' && env.openrouterKey) ||
    env.aiProvider === 'ollama';
  if (!providerOk) missing.push(`AI provider creds (AI_PROVIDER=${env.aiProvider})`);

  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
}
