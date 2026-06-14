import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ClsService } from 'nestjs-cls';

import { env } from '../config/env.config';
import {
  PG_BYPASS_SETTING,
  PG_ORG_SETTING,
  TENANT_CLS_KEY,
  TenantContext,
} from '../tenant/tenant.types';

// Any client capable of running raw SQL — the base client or an interactive tx client.
type RawCapableClient = Pick<PrismaClient, '$executeRaw'>;

function resolveContext(cls: ClsService): TenantContext {
  return cls.isActive() ? cls.get<TenantContext>(TENANT_CLS_KEY) ?? {} : {};
}

function gucValues(ctx: TenantContext): { orgId: string; bypass: string } {
  return { orgId: ctx.organizationId ?? '', bypass: ctx.systemBypass ? 'on' : 'off' };
}

// Methods that MUST stay on the un-extended base client. $transaction is base so the
// interactive/array transaction client it hands out is NOT re-wrapped by the extension
// (which would nest transactions); those sites set the session vars via setTenantContext.
const BASE_METHODS = new Set<string | symbol>([
  '$transaction',
  '$executeRaw',
  '$executeRawUnsafe',
  '$queryRaw',
  '$queryRawUnsafe',
  '$connect',
  '$disconnect',
  '$on',
  '$extends',
  'onModuleInit',
  'onModuleDestroy',
  'setTenantContext',
  'cls',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(readonly cls: ClsService) {
    super({
      adapter: new PrismaPg(new Pool({ connectionString: env.DATABASE_URL })),
    });

    const base = this;
    // Extended client: every model operation runs inside a transaction that first sets
    // the RLS session vars from the current request's tenant context. Reads are then
    // filtered by Postgres RLS; INSERTs inherit organization_id from the column DEFAULT
    // (current_setting('app.current_org_id')).
    const extended = this.$extends({
      name: 'tenant-rls',
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const { orgId, bypass } = gucValues(resolveContext(base.cls));
            const [, result] = await base.$transaction([
              base.$executeRaw`SELECT set_config(${PG_ORG_SETTING}, ${orgId}, true), set_config(${PG_BYPASS_SETTING}, ${bypass}, true)`,
              query(args),
            ]);
            return result as unknown;
          },
        },
      },
    });

    // Route model access through the extended client; keep transactions/raw/lifecycle on base.
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (BASE_METHODS.has(prop)) {
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        }
        const value = (extended as Record<string | symbol, unknown>)[prop];
        if (value === undefined) {
          const fallback = Reflect.get(target, prop, receiver);
          return typeof fallback === 'function' ? fallback.bind(target) : fallback;
        }
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(extended) : value;
      },
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
  // as such a role, tenant isolation is NOT enforced — fail fast in production, warn in dev.
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
    console.warn(`[PrismaService] WARNING: ${message}`);
  }

  // Sets the RLS session vars on an interactive/array transaction client from the current
  // request context. Call as the FIRST statement inside any explicit $transaction so the
  // queries on that connection are correctly tenant-scoped. Pass `overrides` for system
  // tasks (e.g. provisioning) that must bypass or target a specific organization.
  async setTenantContext(
    client: RawCapableClient,
    overrides?: Pick<TenantContext, 'organizationId' | 'systemBypass'>,
  ): Promise<void> {
    const ctx = { ...resolveContext(this.cls), ...overrides };
    const { orgId, bypass } = gucValues(ctx);
    await client.$executeRaw`SELECT set_config(${PG_ORG_SETTING}, ${orgId}, true), set_config(${PG_BYPASS_SETTING}, ${bypass}, true)`;
  }
}
