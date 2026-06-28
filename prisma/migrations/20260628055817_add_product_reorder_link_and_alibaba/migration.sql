-- AlterEnum
ALTER TYPE "SupplierPlatform" ADD VALUE 'ALIBABA';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "reorder_platform" "SupplierPlatform",
ADD COLUMN     "reorder_url" TEXT;
