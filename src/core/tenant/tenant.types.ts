import type { RoleEnum } from '@prisma/client';

// Postgres session variables read by the RLS policies (see enable_rls migration).
export const PG_ORG_SETTING = 'app.current_org_id';
export const PG_BYPASS_SETTING = 'app.bypass_rls';

// Tenant scope for a database operation, resolved from the authenticated request (or forced
// for system tasks such as login lookups, provisioning and seeding). `systemBypass` maps to
// app.bypass_rls = 'on', which lets the query escape tenant filtering.
export interface TenantContext {
  userId?: string;
  role?: RoleEnum;
  organizationId?: string | null;
  systemBypass?: boolean;
}
