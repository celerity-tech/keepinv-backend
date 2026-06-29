-- CreateEnum
CREATE TYPE "StockMovementEffect" AS ENUM ('INCREASE', 'DECREASE', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "stock_movement_type_id" TEXT,
ALTER COLUMN "type" DROP NOT NULL;

-- CreateTable
CREATE TABLE "stock_movement_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effect" "StockMovementEffect" NOT NULL,
    "system_key" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "organization_id" TEXT NOT NULL DEFAULT current_setting('app.current_org_id'::text, true),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_movement_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movement_types_organization_id_idx" ON "stock_movement_types"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movement_types_organization_id_name_key" ON "stock_movement_types"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movement_types_organization_id_system_key_key" ON "stock_movement_types"("organization_id", "system_key");

-- CreateIndex
CREATE INDEX "stock_movements_stock_movement_type_id_idx" ON "stock_movements"("stock_movement_type_id");

-- AddForeignKey
ALTER TABLE "stock_movement_types" ADD CONSTRAINT "stock_movement_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_movement_type_id_fkey" FOREIGN KEY ("stock_movement_type_id") REFERENCES "stock_movement_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
