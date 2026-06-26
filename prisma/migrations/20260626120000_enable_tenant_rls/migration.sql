-- Enable tenant Row-Level Security on every business table that carries organization_id.
-- Each table already DEFAULTs organization_id to current_setting('app.current_org_id', true),
-- which PrismaService sets per request. These policies make Postgres ACTUALLY enforce that
-- boundary: a row is visible/writable only when its organization_id equals the active org,
-- unless app.bypass_rls = 'on' (explicit platform-admin/system paths only).
--
-- Without these policies the organization_id column is decorative — every tenant sees every
-- row. FORCE makes the table OWNER subject to RLS too; only real superusers / BYPASSRLS roles
-- escape it, which is why the backend MUST connect as the non-superuser app_user role
-- (see prisma/rls-setup.sql). Identity tables (users/accounts/sessions/members/organizations/
-- invitations/verifications) are intentionally excluded — Better Auth operates on them without
-- a tenant context.

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'categories',
    'suppliers',
    'supplier_links',
    'locations',
    'products',
    'product_units',
    'stock_movements',
    'sales',
    'sale_items',
    'inventory_audits',
    'inventory_audit_scans'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format($pol$
      CREATE POLICY tenant_isolation ON %I
        USING (
          current_setting('app.bypass_rls', true) = 'on'
          OR organization_id = current_setting('app.current_org_id', true)
        )
        WITH CHECK (
          current_setting('app.bypass_rls', true) = 'on'
          OR organization_id = current_setting('app.current_org_id', true)
        )
    $pol$, tbl);
  END LOOP;
END
$$;
