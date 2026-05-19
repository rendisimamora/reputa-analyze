/**
 * AI-powered sentiment analyzer for Bahasa Indonesia.
 * Works with any OpenAI-compatible provider: OpenAI, Groq, OpenRouter, Ollama.
 *
 * Strict JSON output. Robust against models that ignore response_format
 * (we re-extract JSON from text on failure).
 */
import { aiClient, aiModel, providerSupportsJsonMode } from '@/lib/aiClient';
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
- Skor harus konsisten: sentiment "negative" => sentimentScore < 0; "positive" => > 0.
- Bersikap akurat dan netral, bukan editorial.
- Jika konten tidak relevan dengan subjek, tetap berikan analisis netral.
- JANGAN tambahkan field lain. JANGAN gunakan markdown. HANYA JSON, tidak ada teks pembuka/penutup.`;

interface AnalyzeInput {
  subject?: string;
  title: string;
  snippet?: string | null;
  rawContent?: string | null;
  source: string;
  publishedAt?: Date | null;
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n) + '…';
}

/** Try to extract the first JSON object from arbitrary text (handles markdown fences). */
function extractJson(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch { /* */ } }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch { /* */ }
  }
  return {};
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

  const completion = await aiClient().chat.completions.create({
    model: aiModel(),
    ...(providerSupportsJsonMode() ? { response_format: { type: 'json_object' as const } } : {}),
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Artikel:\n${JSON.stringify(userPayload)}\n\nJawab HANYA dengan JSON sesuai skema.` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = extractJson(raw);
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
