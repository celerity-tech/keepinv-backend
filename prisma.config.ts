import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun prisma/seed.ts",
  },
  // Migrations/DDL run as the owner via DIRECT_URL; DATABASE_URL is the unprivileged app_user
  // (which cannot ALTER tables or manage RLS). Falls back to DATABASE_URL for single-role setups.
  datasource: {
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
  },
});
