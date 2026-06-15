-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);

-- AlterTable
ALTER TABLE "inventory_audit_scans" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);

-- AlterTable
ALTER TABLE "inventory_audits" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);

-- AlterTable
ALTER TABLE "locations" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);

-- AlterTable
ALTER TABLE "product_units" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);

-- AlterTable
ALTER TABLE "sale_items" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);

-- AlterTable
ALTER TABLE "sales" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);

-- AlterTable
ALTER TABLE "supplier_links" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);

-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "organization_id" SET DEFAULT current_setting('app.current_org_id', true);
