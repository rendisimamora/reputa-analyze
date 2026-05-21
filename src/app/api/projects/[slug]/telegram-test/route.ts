/**
 * Test the Telegram bot configuration for a project.
 *
 * POST /api/projects/[slug]/telegram-test
 *   body: { botToken?: string, chatId?: string }
 *
 * If body fields are present, use them (so the user can test BEFORE saving).
 * Otherwise read the saved values from the project.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { sendTelegramTest } from '@/services/telegram';

interface Ctx { params: Promise<{ slug: string }> }

const Body = z.object({
  botToken: z.string().min(1).max(200).optional(),
  chatId: z.string().min(1).max(100).optional(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const project = await prisma.project.findFirst({
      where: { userId: user.id, slug, deletedAt: null },
    });
    if (!project) return jsonError('Not found', 404);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonError('Invalid body', 400, { issues: parsed.error.flatten() });

    const token = (parsed.data.botToken ?? project.telegramBotToken ?? '').trim();
    const chatId = (parsed.data.chatId ?? project.telegramChatId ?? '').trim();
    if (!token || !chatId) {
      return jsonError('Bot token & chat ID wajib diisi sebelum test.', 400);
    }

    const result = await sendTelegramTest(token, chatId, project.name);
    // Persist last error state so settings UI can reflect it without re-testing.
    await prisma.project.update({
      where: { id: project.id },
      data: {
        telegramLastSentAt: result.ok ? new Date() : project.telegramLastSentAt,
        telegramLastError: result.ok ? null : (result.error?.slice(0, 1000) ?? 'unknown'),
      },
    }).catch(() => {});

    if (!result.ok) return jsonError(result.error ?? 'Telegram test failed', 502);
    return jsonOk({ ok: true });
  });
}
