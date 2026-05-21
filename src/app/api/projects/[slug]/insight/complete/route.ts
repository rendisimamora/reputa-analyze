/**
 * Mark an Insight Content idea as completed (or un-mark it).
 *
 * POST /api/projects/[slug]/insight/complete
 * body: { ideaId: string, completed: boolean }
 *
 * Completing an idea also adds its issueCounter to the project's
 * resolvedIssues list, which the LLM uses as an exclusion list on the next
 * regenerate so the same counter-content isn't suggested again.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { setIdeaCompleted } from '@/services/insightContent';

interface Ctx { params: Promise<{ slug: string }> }

const Body = z.object({
  ideaId: z.string().min(1),
  completed: z.boolean(),
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

    const updated = await setIdeaCompleted(project.id, parsed.data.ideaId, parsed.data.completed);
    if (!updated) return jsonError('Idea not found', 404);
    return jsonOk({ content: updated });
  });
}
