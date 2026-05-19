/**
 * Optional bootstrap. Creates a demo admin user if none exists.
 * Run: pnpm seed  (or npm/yarn)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@reputascan.id';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists, skipping.`);
    return;
  }
  const passwordHash = await bcrypt.hash('reputascan123', 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: 'Admin' },
  });
  console.log(`Created user ${user.email} (default password: reputascan123)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
