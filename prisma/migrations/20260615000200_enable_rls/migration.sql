-- Phase 1 / Step 3: Postgres Row-Level Security as the hard tenant-isolation backstop.
-- Each request sets two transaction-local settings via the application:
--   app.current_org_id  -> the caller's organization id
--   app.bypass_rls      -> 'on' for platform SUPER_ADMIN / system tasks (migrations, login, seed)
-- FORCE is required because the app connects as the table owner (which would otherwise
-- bypass RLS). DDL is unaffected by RLS, so this migration applies cleanly. Enabled last,
-- after data is backfilled and constraints are in place.

-- organizations: a tenant may see only its own row; bypass sees all.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "organizations"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "id" = current_setting('app.current_org_id', true));

-- users (organization_id is nullable; SUPER_ADMIN rows are only visible under bypass).
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "users"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));

-- categories
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "categories"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));

-- suppliers
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "suppliers"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));

-- supplier_links
ALTER TABLE "supplier_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "supplier_links"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));

-- locations
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "locations"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));

-- products
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "products"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));

-- product_units
ALTER TABLE "product_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_units" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "product_units"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));

-- stock_movements
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "stock_movements"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));

-- sales
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "sales"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));

-- sale_items
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "sale_items"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));

-- inventory_audits
ALTER TABLE "inventory_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_audits" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_audits"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));

-- inventory_audit_scans
ALTER TABLE "inventory_audit_scans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_audit_scans" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_audit_scans"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "organization_id" = current_setting('app.current_org_id', true));
