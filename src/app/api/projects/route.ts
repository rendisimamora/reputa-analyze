import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { handleApi, jsonError, jsonOk } from '@/lib/apiHelpers';

const CreateBody = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  keywords: z.array(z.string().min(1).max(120)).min(1).max(10),
  matchMode: z.enum(['ANY', 'ALL']).default('ANY'),
});

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    const projects = await prisma.project.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { _count: { select: { mentions: true, alerts: true } }, keywords: true },
      orderBy: { updatedAt: 'desc' },
    });

    // Tally unacknowledged alerts in a single grouped query so we can show a
    // red notification badge on cards that need attention.
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

    const project = await prisma.project.create({
      data: {
        userId: user.id,
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
