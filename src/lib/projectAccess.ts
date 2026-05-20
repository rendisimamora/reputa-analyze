/**
 * Centralized project lookup with ownership + soft-delete checks.
 *
 * Any route that needs "the project for this user and not soft-deleted" should
 * call `getOwnedProject(userId, id)`. Returns `null` if not found, not owned,
 * or soft-deleted.
 *
 * Soft-deleted projects keep all their child data (mentions, alerts, reports,
 * scans) so they can be restored later by clearing `deletedAt` — currently no
 * restore endpoint is exposed, but the data is preserved.
 */
import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

export async function getOwnedProject<T extends Prisma.ProjectInclude>(
  userId: string,
  projectId: string,
  include?: T,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    ...(include ? { include } : {}),
  });
  return project;
}

/** Same as above but does NOT enforce ownership (used by cron / scheduler / standalone). */
export async function getActiveProject(projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
  });
}
