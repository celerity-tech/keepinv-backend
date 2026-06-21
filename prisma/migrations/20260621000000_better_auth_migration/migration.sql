-- Better Auth migration. Forward-only, production-safe, ordered so NO business data is lost.
-- Converts the Passport/JWT identity model to Better Auth (admin + organization plugins, no teams):
--   * existing users/orgs and their IDs are preserved
--   * legacy users.organizationId is backfilled into `members`
--   * users.name is backfilled from first_name/last_name, then those columns are dropped
--   * RLS stays on all business tables; it is removed from the now cross-tenant identity tables
--
-- PASSWORDS: Better Auth uses scrypt; the old hashes are bcrypt and cannot be verified by scrypt.
-- This migration does NOT create credential accounts. After deploying, run
-- `prisma/reset-passwords.ts` once to set each existing user's password (scrypt). Until then,
-- existing users cannot log in. New users provisioned via the API get scrypt credentials directly.
--
-- Statements are defensive (IF [NOT] EXISTS / ON CONFLICT / NOT EXISTS) so a partial re-run is safe.

-- gen_random_uuid(): built into PostgreSQL 13+, also provided by pgcrypto for safety.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===========================================================================================
-- 1. Better Auth tables
-- ===========================================================================================

-- accounts (credentials + linked accounts)
CREATE TABLE IF NOT EXISTS "accounts" (
    "id"                        TEXT NOT NULL,
    "account_id"                TEXT NOT NULL,
    "provider_id"               TEXT NOT NULL,
    "access_token"              TEXT,
    "refresh_token"             TEXT,
    "id_token"                  TEXT,
    "access_token_expires_at"   TIMESTAMP(3),
    "refresh_token_expires_at"  TIMESTAMP(3),
    "scope"                     TEXT,
    "password"                  TEXT,
    "user_id"                   TEXT NOT NULL,
    "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts"("user_id");

-- sessions
CREATE TABLE IF NOT EXISTS "sessions" (
    "id"                       TEXT NOT NULL,
    "expires_at"               TIMESTAMP(3) NOT NULL,
    "token"                    TEXT NOT NULL,
    "ip_address"               TEXT,
    "user_agent"               TEXT,
    "active_organization_id"   TEXT,
    "user_id"                  TEXT NOT NULL,
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_key" ON "sessions"("token");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");

-- verifications
CREATE TABLE IF NOT EXISTS "verifications" (
    "id"          TEXT NOT NULL,
    "identifier"  TEXT NOT NULL,
    "value"       TEXT NOT NULL,
    "expires_at"  TIMESTAMP(3) NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications"("identifier");

-- members (organization plugin)
CREATE TABLE IF NOT EXISTS "members" (
    "id"               TEXT NOT NULL,
    "role"             TEXT NOT NULL DEFAULT 'member',
    "organization_id"  TEXT NOT NULL,
    "user_id"          TEXT NOT NULL,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "members_organization_id_user_id_key" ON "members"("organization_id", "user_id");
CREATE INDEX IF NOT EXISTS "members_organization_id_idx" ON "members"("organization_id");
CREATE INDEX IF NOT EXISTS "members_user_id_idx" ON "members"("user_id");

-- invitations (organization plugin)
CREATE TABLE IF NOT EXISTS "invitations" (
    "id"               TEXT NOT NULL,
    "email"            TEXT NOT NULL,
    "role"             TEXT,
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "expires_at"       TIMESTAMP(3) NOT NULL,
    "inviter_id"       TEXT NOT NULL,
    "organization_id"  TEXT NOT NULL,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "invitations_organization_id_idx" ON "invitations"("organization_id");
CREATE INDEX IF NOT EXISTS "invitations_email_idx" ON "invitations"("email");

-- Foreign keys (guarded so a re-run does not error on duplicates)
DO $$ BEGIN
    ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "members" ADD CONSTRAINT "members_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_fkey"
        FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================================================================
-- 2. New columns on users / organizations (additive)
-- ===========================================================================================

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name"              TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image_url"         TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned"            BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_reason"        TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_expires"       TIMESTAMP(3);

-- Better Auth writes the credential password to accounts, not users.
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
-- The legacy organization_id DB DEFAULT (current_setting('app.current_org_id')) is no longer wanted.
ALTER TABLE "users" ALTER COLUMN "organization_id" DROP DEFAULT;

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "logo"     TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "metadata" TEXT;

-- ===========================================================================================
-- 3. Backfill members  (MUST run while users.role is still the RoleEnum: ADMIN/USER/SUPER_ADMIN)
--    Legacy mapping:  org ADMIN -> 'owner',  org USER -> 'member'.  SUPER_ADMIN has no org row.
-- ===========================================================================================

INSERT INTO "members" ("id", "role", "organization_id", "user_id", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    CASE WHEN u."role"::text = 'ADMIN' THEN 'owner' ELSE 'member' END,
    u."organization_id",
    u."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users" u
WHERE u."organization_id" IS NOT NULL
ON CONFLICT ("organization_id", "user_id") DO NOTHING;

-- ===========================================================================================
-- 4. Backfill Better Auth user fields, then drop the legacy name columns.
-- ===========================================================================================

UPDATE "users"
SET "name" = COALESCE(NULLIF(TRIM(CONCAT_WS(' ', "first_name", "last_name")), ''), "email")
WHERE "name" IS NULL;

-- Existing users predate email verification; treat them as verified so logins keep working.
UPDATE "users" SET "is_email_verified" = true WHERE "is_email_verified" = false;

-- `name` now holds the combined value; the split columns are no longer used.
ALTER TABLE "users" DROP COLUMN IF EXISTS "first_name";
ALTER TABLE "users" DROP COLUMN IF EXISTS "last_name";

-- ===========================================================================================
-- 5. Convert users.role from RoleEnum -> text (admin plugin).  SUPER_ADMIN -> 'admin', rest -> 'user'.
-- ===========================================================================================

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE TEXT
    USING (CASE WHEN "role"::text = 'SUPER_ADMIN' THEN 'admin' ELSE 'user' END);
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';
ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL;

DROP TYPE IF EXISTS "RoleEnum";

-- ===========================================================================================
-- 6. RLS: drop tenant isolation from the now cross-tenant identity tables.
--    Business tables keep RLS (scoped to session.activeOrganizationId at runtime).
--    Better Auth's own Prisma client sets no GUCs, so these tables must NOT be under tenant RLS.
-- ===========================================================================================

DROP POLICY IF EXISTS "tenant_isolation" ON "users";
ALTER TABLE "users" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "organizations";
ALTER TABLE "organizations" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "organizations" DISABLE ROW LEVEL SECURITY;
