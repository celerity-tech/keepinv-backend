-- Phase 1 / Step 2: Now that every existing row is backfilled, enforce the tenant
-- boundary. Sets a column DEFAULT sourced from the per-request session variable
-- app.current_org_id (so application INSERTs that omit organization_id are auto-scoped),
-- makes the column NOT NULL everywhere except users (SUPER_ADMIN stays org-less),
-- swaps every global UNIQUE for an organization-scoped composite UNIQUE, and adds the
-- foreign keys + indexes. Runs only after Step 1 succeeded, so it cannot hit NULLs.

-- Default future inserts to the current tenant (set via SET LOCAL app.current_org_id).
ALTER TABLE "users" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);
ALTER TABLE "categories" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);
ALTER TABLE "suppliers" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);
ALTER TABLE "supplier_links" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);
ALTER TABLE "locations" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);
ALTER TABLE "products" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);
ALTER TABLE "product_units" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);
ALTER TABLE "stock_movements" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);
ALTER TABLE "sales" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);
ALTER TABLE "sale_items" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);
ALTER TABLE "inventory_audits" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);
ALTER TABLE "inventory_audit_scans" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id'::text, true);

-- Enforce NOT NULL on every tenant table EXCEPT users (platform SUPER_ADMINs are org-less).
ALTER TABLE "categories" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "suppliers" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "supplier_links" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "locations" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "product_units" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "stock_movements" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "sales" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "sale_items" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "inventory_audits" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "inventory_audit_scans" ALTER COLUMN "organization_id" SET NOT NULL;

-- Replace global UNIQUE indexes with organization-scoped composite UNIQUE indexes.
DROP INDEX "categories_name_key";
DROP INDEX "locations_code_key";
DROP INDEX "products_sku_key";
DROP INDEX "products_barcode_key";
DROP INDEX "product_units_asset_tag_key";
DROP INDEX "product_units_serial_number_key";
DROP INDEX "product_units_rfid_tag_key";
DROP INDEX "sales_receipt_no_key";
DROP INDEX "inventory_audits_audit_no_key";

-- CreateIndex (organization_id lookup indexes)
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX "categories_organization_id_idx" ON "categories"("organization_id");
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers"("organization_id");
CREATE INDEX "supplier_links_organization_id_idx" ON "supplier_links"("organization_id");
CREATE INDEX "locations_organization_id_idx" ON "locations"("organization_id");
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");
CREATE INDEX "product_units_organization_id_idx" ON "product_units"("organization_id");
CREATE INDEX "stock_movements_organization_id_idx" ON "stock_movements"("organization_id");
CREATE INDEX "sales_organization_id_idx" ON "sales"("organization_id");
CREATE INDEX "sale_items_organization_id_idx" ON "sale_items"("organization_id");
CREATE INDEX "inventory_audits_organization_id_idx" ON "inventory_audits"("organization_id");
CREATE INDEX "inventory_audit_scans_organization_id_idx" ON "inventory_audit_scans"("organization_id");

-- CreateIndex (composite, organization-scoped UNIQUE)
CREATE UNIQUE INDEX "categories_organization_id_name_key" ON "categories"("organization_id", "name");
CREATE UNIQUE INDEX "locations_organization_id_code_key" ON "locations"("organization_id", "code");
CREATE UNIQUE INDEX "products_organization_id_sku_key" ON "products"("organization_id", "sku");
CREATE UNIQUE INDEX "products_organization_id_barcode_key" ON "products"("organization_id", "barcode");
CREATE UNIQUE INDEX "product_units_organization_id_asset_tag_key" ON "product_units"("organization_id", "asset_tag");
CREATE UNIQUE INDEX "product_units_organization_id_serial_number_key" ON "product_units"("organization_id", "serial_number");
CREATE UNIQUE INDEX "product_units_organization_id_rfid_tag_key" ON "product_units"("organization_id", "rfid_tag");
CREATE UNIQUE INDEX "sales_organization_id_receipt_no_key" ON "sales"("organization_id", "receipt_no");
CREATE UNIQUE INDEX "inventory_audits_organization_id_audit_no_key" ON "inventory_audits"("organization_id", "audit_no");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_links" ADD CONSTRAINT "supplier_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_audit_scans" ADD CONSTRAINT "inventory_audit_scans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
