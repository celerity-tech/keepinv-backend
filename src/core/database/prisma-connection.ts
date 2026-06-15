import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { env } from '../config/env.config';

// Singleton database connection (pool + Prisma engine). The request-scoped PrismaService
// wraps this client per request with the tenant RLS extension. Keeping the connection here
// avoids opening a new pool per request.
@Injectable()
export class PrismaConnection extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg(new Pool({ connectionString: env.DATABASE_URL })),
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.assertRlsEnforceable();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Superusers and BYPASSRLS roles silently ignore Row-Level Security. If the app connects
  // as such a role, tenant isolation is NOT enforced — fail fast (when ENFORCE_RLS) or warn.
  private async assertRlsEnforceable(): Promise<void> {
    const rows = await this.$queryRaw<Array<{ is_superuser: boolean; bypassrls: boolean }>>`
      SELECT rolsuper AS is_superuser, rolbypassrls AS bypassrls
      FROM pg_roles WHERE rolname = current_user`;
    const role = rows[0];
    const bypasses = !role || role.is_superuser || role.bypassrls;
    if (!bypasses) return;

    const message =
      'Database role bypasses Row-Level Security (superuser/BYPASSRLS) — tenant isolation is NOT enforced. ' +
      'Connect the backend as the dedicated non-superuser app_user role (see prisma/rls-setup.sql). ' +
      'This MUST be resolved before provisioning a second organization.';
    if (env.ENFORCE_RLS === 'true') throw new Error(message);
    console.warn(`[PrismaConnection] WARNING: ${message}`);
  }
}
