import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

import { authPrisma } from './auth.client';

// Organization-plugin member roles.
export type OrgRole = 'owner' | 'admin' | 'member';

export interface NewUserInput {
  email: string;
  password: string;
  name: string;
}

// Creates a Better Auth user plus a `credential` account hashed with Better Auth's default scrypt
// — the exact shape its sign-in/email flow expects — so the new account can log in immediately.
// System role stays 'user'; organization authority is granted separately via `members`. Runs on
// the plain Better Auth Prisma client (identity tables are excluded from tenant RLS), so it works
// for both platform (system-admin) and tenant-admin onboarding without a tenant context.
export async function createCredentialUser(
  tx: Prisma.TransactionClient,
  input: NewUserInput,
) {
  const email = input.email.trim().toLowerCase();

  const existing = await tx.user.findUnique({ where: { email } });
  if (existing) throw new ConflictException('Email already in use');

  const user = await tx.user.create({
    data: {
      email,
      name: input.name,
      emailVerified: true,
      role: 'user',
    },
    omit: { password: true },
  });

  await tx.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password: await hashPassword(input.password),
    },
  });

  return user;
}

// Creates a credential user and attaches them to an organization with the given role, atomically.
export async function provisionOrganizationUser(
  organizationId: string,
  input: NewUserInput,
  role: OrgRole,
) {
  return authPrisma.$transaction(async (tx) => {
    const user = await createCredentialUser(tx, input);
    await tx.member.create({ data: { organizationId, userId: user.id, role } });
    return user;
  });
}
