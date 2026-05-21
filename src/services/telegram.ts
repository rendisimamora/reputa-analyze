/**
 * Telegram Bot notifier.
 *
 * Uses the bot HTTP API directly (no SDK needed):
 *   POST https://api.telegram.org/bot<TOKEN>/sendMessage
 *
 * Each project carries its own bot token + chat id (configured in settings).
 * sendAlertToTelegram is fire-and-forget from the caller's perspective —
 * failures are persisted to Project.telegramLastError so the user can see
 * them in the settings UI.
 */
import { prisma } from '@/lib/prisma';
import type { Alert, Project } from '@prisma/client';

interface SampleLike {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
}

const TG_API_BASE = 'https://api.telegram.org';
const SEND_TIMEOUT_MS = 8000;

const SEVERITY_EMOJI: Record<Alert['severity'], string> = {
  LOW: 'ℹ️',
  MEDIUM: '⚠️',
  HIGH: '🚨',
  CRITICAL: '🔥',
};

function escapeMarkdownV2(s: string): string {
  // Telegram MarkdownV2 reserved chars
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (m) => `\\${m}`);
}

/**
 * Send a test message. Returns { ok, error? } so the settings UI can show feedback.
 */
export async function sendTelegramTest(
  botToken: string,
  chatId: string,
  projectName: string,
): Promise<{ ok: boolean; error?: string }> {
  const text = [
    `✅ *${escapeMarkdownV2('ReputaScan ID')}* test connection`,
    ``,
    `Project: ${escapeMarkdownV2(projectName)}`,
    `Notifikasi alert akan dikirim ke chat ini\\.`,
  ].join('\n');

  return postMessage(botToken, chatId, text);
}

/**
 * Push an Alert to Telegram. Reads bot token + chat id from project record.
 * Updates project.telegramLastSentAt / telegramLastError accordingly.
 */
export async function sendAlertToTelegram(project: Project, alert: Alert): Promise<{ ok: boolean; error?: string }> {
  if (!project.telegramEnabled) return { ok: false, error: 'disabled' };
  const token = project.telegramBotToken?.trim();
  const chatId = project.telegramChatId?.trim();
  if (!token || !chatId) {
    return { ok: false, error: 'Telegram not configured (missing bot token or chat id)' };
  }

  const samples = extractSamples(alert.payload);
  const text = buildAlertMessage(project.name, alert, samples);

  const result = await postMessage(token, chatId, text);

  // Persist last-send status — best-effort
  await prisma.project.update({
    where: { id: project.id },
    data: {
      telegramLastSentAt: new Date(),
      telegramLastError: result.ok ? null : (result.error?.slice(0, 1000) ?? 'unknown'),
    },
  }).catch(() => {});

  return result;
}

function extractSamples(payload: unknown): SampleLike[] {
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as { samples?: unknown };
  if (!Array.isArray(obj.samples)) return [];
  return obj.samples
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map((x) => ({
      title: String(x.title ?? '').slice(0, 200),
      url: String(x.url ?? ''),
      source: String(x.source ?? ''),
      publishedAt: typeof x.publishedAt === 'string' ? x.publishedAt : null,
    }))
    .filter((s) => s.title && s.url);
}

function buildAlertMessage(projectName: string, alert: Alert, samples: SampleLike[]): string {
  const emoji = SEVERITY_EMOJI[alert.severity];
  const lines: string[] = [];

  lines.push(`${emoji} *${escapeMarkdownV2(alert.title)}*`);
  lines.push(`_${escapeMarkdownV2(projectName)}_ · ${escapeMarkdownV2(alert.severity)}`);
  lines.push('');
  lines.push(escapeMarkdownV2(alert.message));

  if (samples.length > 0) {
    lines.push('');
    lines.push('*Berita pemicu:*');
    for (const s of samples.slice(0, 3)) {
      const dateBit = s.publishedAt
        ? ` _${escapeMarkdownV2(new Date(s.publishedAt).toLocaleDateString('id-ID'))}_`
        : '';
      // Hyperlink-friendly: titles inside [], urls inside ()
      lines.push(`• [${escapeMarkdownV2(s.title)}](${s.url}) — ${escapeMarkdownV2(s.source)}${dateBit}`);
    }
  }

  return lines.join('\n');
}

async function postMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const r = await fetch(`${TG_API_BASE}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: false },
      }),
      signal: controller.signal,
    });
    const data = await r.json().catch(() => ({})) as { ok?: boolean; description?: string };
    if (!r.ok || !data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${r.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
