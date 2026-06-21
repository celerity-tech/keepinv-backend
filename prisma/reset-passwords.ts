import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { Pool } from 'pg';

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ONE-TIME password reset for users that existed BEFORE the Better Auth migration.
//
// Their old hashes were bcrypt; Better Auth uses scrypt and cannot verify bcrypt, so existing
// users must be given fresh passwords (hashed with Better Auth's scrypt) before they can log in.
//
// 1. Fill in every existing user's email -> the new password below.
// 2. Run once against the database (locally or via a Railway one-off shell):
//      DATABASE_URL="<your database url>" bun prisma/reset-passwords.ts
//    Safe to re-run; it upserts the credential account.
// ─────────────────────────────────────────────────────────────────────────────────────────────
const PASSWORDS: Record<string, string> = {
  'admin@geoplan.ph': 'superadmin',
  'anbertbrinces@gmail.com': 'anbertbrinces',
  'acegabriel0809@gmail.com': 'pogingace',
  'agent@rapidomotorsiklo.com': 'hermesagent',
  'operations@rapidomotorsiklo.com': 'admin123',
  'hermes.rapido@assetwise.local': 'tonton123',
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const entries = Object.entries(PASSWORDS);
  if (entries.length === 0) {
    console.error('Nothing to do: fill in the PASSWORDS map first.');
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url })) });

  for (const [emailRaw, password] of entries) {
    const email = emailRaw.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.warn(`skip (no such user): ${email}`);
      continue;
    }

    const hashed = await hashPassword(password);
    const existing = await prisma.account.findFirst({
      where: { userId: user.id, providerId: 'credential' },
    });

    if (existing) {
      await prisma.account.update({ where: { id: existing.id }, data: { password: hashed } });
    } else {
      await prisma.account.create({
        data: { userId: user.id, accountId: user.id, providerId: 'credential', password: hashed },
      });
    }
    console.log(`password set: ${email}`);
  }

  await prisma.$disconnect();
  console.log('done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
