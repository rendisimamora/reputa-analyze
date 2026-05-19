import OpenAI from 'openai';
import { env } from './env';

let _client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!env.openaiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (!_client) {
    _client = new OpenAI({ apiKey: env.openaiKey });
  }
  return _client;
}
