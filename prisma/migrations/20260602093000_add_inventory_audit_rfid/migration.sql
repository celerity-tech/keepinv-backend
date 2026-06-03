-- CreateEnum
CREATE TYPE "InventoryAuditStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryAuditScanResult" AS ENUM ('MATCHED', 'MISPLACED', 'UNKNOWN_TAG');

-- CreateEnum
CREATE TYPE "InventoryAuditScanMode" AS ENUM ('RFID', 'BARCODE', 'MANUAL');

-- CreateTable
CREATE TABLE "inventory_audits" (
    "id" TEXT NOT NULL,
    "audit_no" TEXT NOT NULL,
    "status" "InventoryAuditStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "location_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_audit_scans" (
    "id" TEXT NOT NULL,
    "scan_value" TEXT NOT NULL,
    "scan_mode" "InventoryAuditScanMode" NOT NULL DEFAULT 'RFID',
    "audit_id" TEXT NOT NULL,
    "product_unit_id" TEXT,
    "result" "InventoryAuditScanResult" NOT NULL DEFAULT 'UNKNOWN_TAG',
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_audit_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_audits_audit_no_key" ON "inventory_audits"("audit_no");

-- CreateIndex
CREATE INDEX "inventory_audits_location_id_idx" ON "inventory_audits"("location_id");

-- CreateIndex
CREATE INDEX "inventory_audits_user_id_idx" ON "inventory_audits"("user_id");

-- CreateIndex
CREATE INDEX "inventory_audits_status_idx" ON "inventory_audits"("status");

-- CreateIndex
CREATE INDEX "inventory_audits_started_at_idx" ON "inventory_audits"("started_at");

-- CreateIndex
CREATE INDEX "inventory_audit_scans_audit_id_idx" ON "inventory_audit_scans"("audit_id");

-- CreateIndex
CREATE INDEX "inventory_audit_scans_scan_value_idx" ON "inventory_audit_scans"("scan_value");

-- CreateIndex
CREATE INDEX "inventory_audit_scans_product_unit_id_idx" ON "inventory_audit_scans"("product_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_audit_scans_audit_id_scan_value_key" ON "inventory_audit_scans"("audit_id", "scan_value");

-- AddForeignKey
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_scans" ADD CONSTRAINT "inventory_audit_scans_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "inventory_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_scans" ADD CONSTRAINT "inventory_audit_scans_product_unit_id_fkey" FOREIGN KEY ("product_unit_id") REFERENCES "product_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
