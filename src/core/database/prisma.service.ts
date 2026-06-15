import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import { PrismaClient, RoleEnum } from '@prisma/client';

import { PrismaConnection } from './prisma-connection';
import { PG_BYPASS_SETTING, PG_ORG_SETTING, TenantContext } from '../tenant/tenant.types';

// Any client capable of running raw SQL — the base client or an interactive tx client.
type RawCapableClient = Pick<PrismaClient, '$executeRaw'>;

interface RequestWithUser {
  user?: { id?: string; role?: RoleEnum; organizationId?: string | null };
}

// Methods served by the singleton connection (transactions/raw/lifecycle). $transaction is
// the connection's so the interactive/array tx client it hands out is NOT re-wrapped by the
// extension (which would nest transactions); those sites set the session vars themselves.
const CONNECTION_METHODS = new Set<string | symbol>([
  '$transaction',
  '$executeRaw',
  '$executeRawUnsafe',
  '$queryRaw',
  '$queryRawUnsafe',
  '$connect',
  '$disconnect',
  '$on',
]);

// Methods served by this wrapper instance.
const SELF_METHODS = new Set<string | symbol>(['setTenantContext']);

// Declaration merge: at runtime the constructor returns a Proxy that delegates model access
// (user, product, ...) and $transaction/raw to the underlying PrismaClient, so the instance
// has the full client surface. This interface gives callers those types alongside the
// wrapper's own setTenantContext.
export interface PrismaService extends PrismaClient {}

// Request-scoped: the tenant is read directly from the authenticated request.user on every
// query. This deliberately avoids AsyncLocalStorage — Prisma's query engine detaches the ALS
// context after the first query in a request, so a CLS-based approach silently loses the
// tenant on the second query. The request object is stable for the whole request.
@Injectable({ scope: Scope.REQUEST })
export class PrismaService {
  constructor(
    private readonly connection: PrismaConnection,
    @Inject(REQUEST) private readonly request: RequestWithUser,
  ) {
    const base = connection;
    const self = this;

    const extended = connection.$extends({
      name: 'tenant-rls',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args }) {
            const { orgId, bypass } = self.resolveGuc();
            const delegateKey = model.charAt(0).toLowerCase() + model.slice(1);
            // Interactive transaction: set the RLS session vars (awaited, so applied before
            // the query), then re-dispatch the operation onto the same connection. Reads are
            // filtered by RLS; INSERTs inherit organization_id from the column DEFAULT.
            return base.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT set_config(${PG_ORG_SETTING}, ${orgId}, true), set_config(${PG_BYPASS_SETTING}, ${bypass}, true)`;
              const delegate = (tx as unknown as Record<string, Record<string, (a: unknown) => unknown>>)[delegateKey];
              return delegate[operation](args);
            });
          },
        },
      },
    });

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (SELF_METHODS.has(prop)) {
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        }
        if (CONNECTION_METHODS.has(prop)) {
          const value = (base as unknown as Record<string | symbol, unknown>)[prop];
          return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(base) : value;
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

  // Resolves the RLS session-variable values from the current request (or explicit overrides
  // for system tasks such as login lookups, provisioning and seeding).
  private resolveGuc(overrides?: Pick<TenantContext, 'organizationId' | 'systemBypass'>): {
    orgId: string;
    bypass: string;
  } {
    const user = this.request?.user;
    const organizationId = overrides?.organizationId ?? user?.organizationId ?? '';
    const systemBypass = overrides?.systemBypass ?? user?.role === RoleEnum.SUPER_ADMIN;
    return { orgId: organizationId ?? '', bypass: systemBypass ? 'on' : 'off' };
  }

  // Sets the RLS session vars on an interactive/array transaction client. Call as the FIRST
  // statement inside any explicit $transaction so its queries are correctly tenant-scoped.
  async setTenantContext(
    client: RawCapableClient,
    overrides?: Pick<TenantContext, 'organizationId' | 'systemBypass'>,
  ): Promise<void> {
    const { orgId, bypass } = this.resolveGuc(overrides);
    await client.$executeRaw`SELECT set_config(${PG_ORG_SETTING}, ${orgId}, true), set_config(${PG_BYPASS_SETTING}, ${bypass}, true)`;
  }
}
