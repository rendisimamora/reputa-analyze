/**
 * One-off scan trigger for a specific project ID (or all active).
 *   pnpm scan:once <projectId?>
 */
import { prisma } from '@/lib/prisma';
import { runScan } from '@/services/scanRunner';
import { assertServerEnv } from '@/lib/env';

async function main() {
  assertServerEnv();
  const arg = process.argv[2];
  const projects = arg
    ? await prisma.project.findMany({ where: { id: arg } })
    : await prisma.project.findMany({ where: { active: true } });
  if (!projects.length) {
    console.log('No matching projects.');
    return;
  }
  for (const p of projects) {
    console.log(`Scanning "${p.name}" (${p.id})...`);
    const r = await runScan(p.id, 'MANUAL');
    console.log(`  +${r.newMentions} new, ${r.analyzed} analyzed, score=${r.score}, errors=${r.errors}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
