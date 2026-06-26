-- ============================================================================
-- ONE-TIME Row-Level Security role setup. Run ONCE per database, as the database
-- OWNER / superuser (on Railway: the default `postgres` user), AFTER migrations
-- have created the tables.
--
-- WHY: Postgres superusers and table owners BYPASS Row-Level Security even when
-- FORCE ROW LEVEL SECURITY is set. For tenant isolation to actually be enforced,
-- the backend MUST connect as a dedicated, least-privilege, NON-superuser role.
--
-- STEPS:
--   1. Replace 'CHANGE_ME_STRONG_PASSWORD' below with a strong secret.
--   2. Run this whole file connected to the application database.
--   3. Point the backend's DATABASE_URL at this app_user role.
--   4. Keep migrations running as the owner via DIRECT_URL (see .env.example).
-- The password lives ONLY in your backend's DATABASE_URL secret — never commit it.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD'
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- Schema + DML on all existing tables (NOT ownership — owners bypass RLS).
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Tables/sequences created by FUTURE migrations (run as the owner) are granted too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Prisma's migration bookkeeping table is owner-only; app_user must NOT touch it.
REVOKE ALL ON TABLE "_prisma_migrations" FROM app_user;
w