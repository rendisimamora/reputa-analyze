/**
 * AI provider abstraction.
 *
 * All supported providers expose an OpenAI-compatible /chat/completions endpoint,
 * so we re-use the official `openai` SDK and just swap baseURL + key + default model.
 *
 * Supported:
 *  - openai  (gpt-4o-mini)             — paid, default
 *  - groq    (llama-3.3-70b-versatile) — free tier, fast (LPU)
 *  - ollama  (llama3.2 etc.)            — local, free, runs on user machine
 *  - openrouter (any free model)       — pay/free mixed
 */
import OpenAI from 'openai';
import { env } from './env';

export type AIProvider = 'openai' | 'groq' | 'ollama' | 'openrouter';

interface ProviderConfig {
  baseURL?: string;
  defaultModel: string;
  apiKey: () => string;
  /** Some providers (Ollama on certain models) don't honor response_format. */
  supportsJsonMode: boolean;
}

const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  openai: {
    defaultModel: 'gpt-4o-mini',
    apiKey: () => env.openaiKey,
    supportsJsonMode: true,
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    apiKey: () => env.groqKey,
    supportsJsonMode: true,
  },
  ollama: {
    baseURL: env.ollamaBaseUrl,
    defaultModel: 'llama3.2:3b',
    apiKey: () => 'ollama', // not validated by Ollama
    supportsJsonMode: false, // many Ollama models ignore response_format — we add a prompt fallback
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    apiKey: () => env.openrouterKey,
    supportsJsonMode: true,
  },
};

let _client: OpenAI | null = null;
let _cachedProvider: AIProvider | null = null;

export function getProvider(): AIProvider {
  const p = (env.aiProvider || 'openai') as AIProvider;
  if (!(p in PROVIDERS)) throw new Error(`Unknown AI_PROVIDER: ${p}`);
  return p;
}

export function aiClient(): OpenAI {
  const provider = getProvider();
  const cfg = PROVIDERS[provider];
  const key = cfg.apiKey();

  if (provider !== 'ollama' && !key) {
    throw new Error(
      `Provider "${provider}" selected but its API key env var is empty. ` +
      `Set ${provider.toUpperCase()}_API_KEY in .env, or change AI_PROVIDER.`,
    );
  }

  if (!_client || _cachedProvider !== provider) {
    _client = new OpenAI({ apiKey: key || 'unused', baseURL: cfg.baseURL });
    _cachedProvider = provider;
  }
  return _client;
}

export function aiModel(): string {
  if (env.aiModel) return env.aiModel;
  return PROVIDERS[getProvider()].defaultModel;
}

export function providerSupportsJsonMode(): boolean {
  return PROVIDERS[getProvider()].supportsJsonMode;
}

export function hasAiConfigured(): boolean {
  try {
    const p = getProvider();
    if (p === 'ollama') return true;
    return !!PROVIDERS[p].apiKey();
  } catch {
    return false;
  }
}
