/**
 * One-off scan trigger for a specific project ID (or all active).
 *   npm run scan:once <projectId?>
 *
 * Bypasses the queue and executes scans inline — useful for local debugging
 * or for first-run priming. Do NOT use this in production; PM2 worker handles
 * the real workload.
 */
import { prisma } from '@/lib/prisma';
import { enqueueScan, executeScan } from '@/services/scanRunner';
import { assertServerEnv } from '@/lib/env';

async function main() {
  assertServerEnv();
  const arg = process.argv[2];
  const projects = arg
    ? await prisma.project.findMany({ where: { id: arg, deletedAt: null } })
    : await prisma.project.findMany({ where: { active: true, deletedAt: null } });
  if (!projects.length) {
    console.log('No matching projects.');
    return;
  }
  for (const p of projects) {
    console.log(`Scanning "${p.name}" (${p.id})...`);
    const scanRunId = await enqueueScan(p.id, 'MANUAL');
    // immediately claim the row we just inserted so executeScan sees it as RUNNING
    await prisma.scanRun.update({
      where: { id: scanRunId },
      data: { status: 'RUNNING', claimedAt: new Date() },
    });
    const r = await executeScan(scanRunId);
    console.log(`  +${r.newMentions} new, ${r.analyzed} analyzed, score=${r.score}, errors=${r.errors}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
