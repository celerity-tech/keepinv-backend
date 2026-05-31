-- CreateEnum
CREATE TYPE "SupplierPlatform" AS ENUM ('MESSENGER', 'VIBER', 'SHOPEE', 'LAZADA', 'FACEBOOK', 'WEBSITE', 'OTHER');

-- CreateTable
CREATE TABLE "supplier_links" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "platform" "SupplierPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_links_supplier_id_idx" ON "supplier_links"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_links_supplier_id_platform_key" ON "supplier_links"("supplier_id", "platform");

-- AddForeignKey
ALTER TABLE "supplier_links" ADD CONSTRAINT "supplier_links_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
