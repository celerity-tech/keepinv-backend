import type { RoleEnum } from '@prisma/client';

// Key under which the per-request tenant context lives in CLS (nestjs-cls).
export const TENANT_CLS_KEY = 'tenant';

// Postgres session variables read by the RLS policies (see enable_rls migration).
export const PG_ORG_SETTING = 'app.current_org_id';
export const PG_BYPASS_SETTING = 'app.bypass_rls';

// Resolved once per request from the authenticated user (or forced for system tasks
// such as login lookups, provisioning and seeding). `systemBypass` maps to
// app.bypass_rls = 'on', which lets the query escape tenant filtering.
export interface TenantContext {
  userId?: string;
  role?: RoleEnum;
  organizationId?: string | null;
  systemBypass?: boolean;
}
