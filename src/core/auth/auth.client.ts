import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { env } from '../config/env.config';

// Plain Prisma client used ONLY by Better Auth's adapter. It has NO RLS extension and sets no
// tenant GUCs: Better Auth operates on the cross-tenant identity tables (user, account, session,
// verification, member, organization, invitation), which are intentionally excluded from tenant
// RLS. Business modules use the request-scoped PrismaService (RLS-enforced) instead.
export const authPrisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: env.DATABASE_URL })),
});
