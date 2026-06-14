-- Phase 1 / Step 1: Introduce the Organization tenant boundary WITHOUT touching
-- existing data integrity. Strictly additive: create the table, seed the first
-- organization (Rapido Motorsiklo Garage), add a NULLABLE organization_id to every
-- tenant table, then backfill all existing rows to that organization. NOT NULL,
-- foreign keys, composite uniques and RLS are deferred to later migrations so this
-- step can never fail on populated production tables.

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- Seed the first (existing client) organization. Fixed UUID so the backfill below
-- and any future reference is deterministic. Idempotent on slug.
INSERT INTO "organizations" ("id", "name", "slug", "is_active", "created_at", "updated_at")
VALUES ('ae73d42d-aa5d-4a9f-a3a0-d92fa831d853', 'Rapido Motorsiklo Garage', 'rapido-motorsiklo-garage', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- AddColumn (nullable for now) on every tenant table
ALTER TABLE "users" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "categories" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "supplier_links" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "locations" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "products" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "product_units" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "sales" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "sale_items" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "inventory_audits" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "inventory_audit_scans" ADD COLUMN "organization_id" TEXT;

-- Backfill existing production data to the first organization.
-- Non-SUPER_ADMIN users belong to the client's organization; SUPER_ADMIN platform
-- operators stay org-less (organization_id remains NULL).
UPDATE "users" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853' WHERE "role" <> 'SUPER_ADMIN';
UPDATE "categories" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';
UPDATE "suppliers" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';
UPDATE "supplier_links" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';
UPDATE "locations" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';
UPDATE "products" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';
UPDATE "product_units" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';
UPDATE "stock_movements" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';
UPDATE "sales" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';
UPDATE "sale_items" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';
UPDATE "inventory_audits" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';
UPDATE "inventory_audit_scans" SET "organization_id" = 'ae73d42d-aa5d-4a9f-a3a0-d92fa831d853';
