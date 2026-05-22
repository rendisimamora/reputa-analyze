import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';
import { generateUniqueProjectSlug } from '@/lib/slug';

const CreateBody = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  keywords: z.array(z.string().min(1).max(120)).min(1).max(10),
  matchMode: z.enum(['ANY', 'ALL']).default('ANY'),
});

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    // Trim heavy fields: insightContentJson + insightKeywordJson are now sizable
    // JSON blobs, aiExecutive/aiRecommendation are long text, telegramBotToken
    // is sensitive. None of those are needed by the projects card list or the
    // sidebar dropdown — both only use id, slug, name, description, lastScanAt,
    // keywords[].term, and _count.
    const projects = await prisma.project.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        lastScanAt: true,
        _count: { select: { mentions: true, alerts: true } },
        keywords: { select: { term: true } },
      },
    });

    const unack = await prisma.alert.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projects.map((p) => p.id) }, acknowledged: false },
      _count: { _all: true },
    });
    const unackMap = new Map(unack.map((r) => [r.projectId, r._count._all]));

    return jsonOk({
      projects: projects.map((p) => ({
        ...p,
        unacknowledgedAlerts: unackMap.get(p.id) ?? 0,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser();
    const parsed = CreateBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonError('Invalid body', 400, { issues: parsed.error.flatten() });

    // Auto-generate slug from name. Per-user unique, immutable after this point.
    const slug = await generateUniqueProjectSlug(user.id, parsed.data.name);

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        slug,
        name: parsed.data.name,
        description: parsed.data.description,
        keywords: {
          create: [...new Set(parsed.data.keywords.map((k) => k.trim()))].map((term) => ({
            term,
            matchMode: parsed.data.matchMode,
          })),
        },
      },
      include: { keywords: true },
    });
    return jsonOk({ project }, { status: 201 });
  });
}
