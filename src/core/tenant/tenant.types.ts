// Postgres session variables read by the RLS policies (see enable_rls migration).
export const PG_ORG_SETTING = 'app.current_org_id';
export const PG_BYPASS_SETTING = 'app.bypass_rls';

// Tenant scope for a database operation, resolved from the Better Auth session's
// activeOrganizationId (or forced for system tasks such as provisioning and seeding).
// `systemBypass` maps to app.bypass_rls = 'on', which lets the query escape tenant filtering;
// it is set ONLY by explicit platform-admin code paths, never automatically per request.
export interface TenantContext {
  userId?: string;
  role?: string | string[] | null;
  organizationId?: string | null;
  systemBypass?: boolean;
}
