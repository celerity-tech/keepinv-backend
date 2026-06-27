import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from 'better-auth/crypto';
import { Pool } from 'pg';

// Default bootstrap platform admin (Better Auth system role 'admin' = SUPER_ADMIN). Org-less.
// Change the password via the running app immediately after first login. Do NOT deploy with
// these defaults in place.
const ADMIN_EMAIL = 'admin@keepinv.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'Platform Admin';

const BOOTSTRAP_DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!BOOTSTRAP_DATABASE_URL) {
  console.error('Missing DIRECT_URL or DATABASE_URL in environment.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: BOOTSTRAP_DATABASE_URL })),
});

async function main() {
  const email = ADMIN_EMAIL.trim().toLowerCase();

  // Identity tables (users/accounts) are not under tenant RLS, so no bypass is needed here.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${existing.email} (id=${existing.id}). Skipping.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name: ADMIN_NAME, emailVerified: true, role: 'admin' },
      select: { id: true, email: true, role: true },
    });

    await tx.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: 'credential',
        password: await hashPassword(ADMIN_PASSWORD),
      },
    });

    console.log(`Admin created: ${user.email} (id=${user.id}, role=${user.role})`);
    console.log(`Default password: ${ADMIN_PASSWORD} — change it after first login.`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
