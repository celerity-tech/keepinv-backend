/*
  Warnings:

  - You are about to drop the column `parent_id` on the `locations` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "locations" DROP CONSTRAINT "locations_parent_id_fkey";

-- DropIndex
DROP INDEX "locations_parent_id_idx";

-- AlterTable
ALTER TABLE "locations" DROP COLUMN "parent_id";
