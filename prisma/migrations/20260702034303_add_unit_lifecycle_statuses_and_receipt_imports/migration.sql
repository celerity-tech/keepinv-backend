-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductUnitStatus" ADD VALUE 'MISPLACED';
ALTER TYPE "ProductUnitStatus" ADD VALUE 'MISSING';
ALTER TYPE "ProductUnitStatus" ADD VALUE 'DISPOSED';

-- CreateTable
CREATE TABLE "receipt_imports" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL DEFAULT current_setting('app.current_org_id'::text, true),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receipt_imports_organization_id_idx" ON "receipt_imports"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_imports_organization_id_idempotency_key_key" ON "receipt_imports"("organization_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "receipt_imports" ADD CONSTRAINT "receipt_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant Row-Level Security for the new table (Prisma cannot express RLS in schema.prisma; this
-- mirrors 20260626120000_enable_tenant_rls so receipt_imports is isolated per organization too).
ALTER TABLE "receipt_imports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receipt_imports" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "receipt_imports";
CREATE POLICY tenant_isolation ON "receipt_imports"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR organization_id = current_setting('app.current_org_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR organization_id = current_setting('app.current_org_id', true)
  );
