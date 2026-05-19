/**
 * OpenAI-powered sentiment analyzer for Bahasa Indonesia.
 * Returns strict JSON output via response_format.
 *
 * Only OpenAI is used here, and ONLY for sentiment analysis — as per spec.
 */
import { openai } from '@/lib/openai';
import { env } from '@/lib/env';
import type { SentimentResult } from '@/types';

const SYSTEM = `Anda adalah analis sentimen media berbahasa Indonesia yang profesional.
Tugas Anda adalah menganalisis sebuah artikel berita untuk sebuah subjek (tokoh, perusahaan, brand, organisasi, atau isu).

Outputkan SELALU dalam JSON valid dengan skema persis berikut:
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentScore": number antara -1 (sangat negatif) sampai 1 (sangat positif),
  "emotion": string singkat (mis. "marah", "khawatir", "optimistis", "netral", "kecewa", "bangga"),
  "toxicity": number 0..1 indikasi toxic / kasar / serangan personal,
  "hateSpeech": number 0..1 indikasi ujaran kebencian berbasis SARA,
  "fakeNews": number 0..1 indikasi hoaks / klaim tanpa bukti / disinformasi,
  "topic": string singkat (3-6 kata) topik utama,
  "summary": string ringkas 1-2 kalimat dalam Bahasa Indonesia
}

Aturan:
- Skor harus konsisten: sentiment "negative" ⇒ sentimentScore < 0; "positive" ⇒ > 0.
- Bersikap akurat dan netral, bukan editorial.
- Jika konten tidak relevan dengan subjek, tetap berikan analisis netral.
- JANGAN tambahkan field lain. JANGAN gunakan markdown. HANYA JSON.`;

interface AnalyzeInput {
  subject?: string;            // optional: project name / keyword to anchor analysis
  title: string;
  snippet?: string | null;
  rawContent?: string | null;
  source: string;
  publishedAt?: Date | null;
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

export async function analyzeSentiment(input: AnalyzeInput): Promise<SentimentResult> {
  const userPayload = {
    subject: input.subject ?? null,
    source: input.source,
    publishedAt: input.publishedAt ? input.publishedAt.toISOString() : null,
    title: input.title,
    snippet: input.snippet ?? null,
    content: truncate(input.rawContent ?? '', 6000),
  };

  const completion = await openai().chat.completions.create({
    model: env.openaiModel,
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  return normalizeResult(parsed);
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return (min + max) / 2;
  return Math.max(min, Math.min(max, n));
}

function normalizeResult(r: Record<string, unknown>): SentimentResult {
  const sentimentRaw = String(r.sentiment ?? 'neutral').toLowerCase();
  const sentiment =
    sentimentRaw.startsWith('pos')
      ? 'POSITIVE'
      : sentimentRaw.startsWith('neg')
        ? 'NEGATIVE'
        : 'NEUTRAL';
  let score = Number(r.sentimentScore);
  if (Number.isNaN(score)) score = sentiment === 'POSITIVE' ? 0.5 : sentiment === 'NEGATIVE' ? -0.5 : 0;
  score = clamp(score, -1, 1);
  // sanity: align sign with label
  if (sentiment === 'POSITIVE' && score < 0) score = Math.abs(score);
  if (sentiment === 'NEGATIVE' && score > 0) score = -Math.abs(score);
  if (sentiment === 'NEUTRAL' && Math.abs(score) > 0.4) score = score > 0 ? 0.2 : -0.2;

  return {
    sentiment,
    sentimentScore: score,
    emotion: String(r.emotion ?? 'netral').slice(0, 32),
    toxicity: clamp(Number(r.toxicity ?? 0), 0, 1),
    hateSpeech: clamp(Number(r.hateSpeech ?? 0), 0, 1),
    fakeNews: clamp(Number(r.fakeNews ?? 0), 0, 1),
    topic: String(r.topic ?? '').slice(0, 80),
    summary: String(r.summary ?? '').slice(0, 600),
  };
}
