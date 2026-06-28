# Row-Level Security (RLS) Setup

This document explains the multi-tenant isolation model, the two-connection pattern, and how to apply RLS to an existing database that was set up before this migration was added.

---

## Why RLS is needed

Keepinv is a multi-tenant application. Every business table (`categories`, `products`, `sales`, etc.) carries an `organization_id` column that scopes rows to a single tenant. Without RLS, that column is decorative — any authenticated user can query any tenant's data by crafting a direct SQL statement.

Postgres Row-Level Security makes the boundary real at the database engine level. The migration `20260626120000_enable_tenant_rls` enables RLS policies on all business tables so that a row is only visible or writable when `organization_id` matches the `app.current_org_id` session variable set by `PrismaService` per request.

**Critical caveat:** Postgres superusers and table owners bypass RLS unconditionally, even when `FORCE ROW LEVEL SECURITY` is set. If the backend connects as the `postgres` owner, the policies are silently ignored and every tenant sees every row. The backend must connect as a dedicated, non-superuser role (`app_user`) for the policies to be enforced.

---

## The two-connection pattern

| Variable       | Role         | Used by                          | Bypasses RLS? |
|----------------|--------------|----------------------------------|---------------|
| `DIRECT_URL`   | `postgres`   | `prisma migrate deploy` (DDL)    | Yes (owner)   |
| `DATABASE_URL` | `app_user`   | The running NestJS application   | No            |

Prisma reads `DIRECT_URL` for schema migrations and `DATABASE_URL` for all runtime queries. This means migrations can create tables and alter schemas (which requires owner privileges) while the app itself operates under full RLS enforcement.

In local development both can point at the same superuser URL — RLS is still applied structurally, but `ENFORCE_RLS=false` lets the app boot without the role check. Set `ENFORCE_RLS=true` before provisioning a second organization.

---

## How the migration applies RLS

Two migrations work together:

1. **`20260626120000_enable_tenant_rls`** — enables RLS and creates the `tenant_isolation` policy on every business table. This runs as the DB owner via `DIRECT_URL` during `prisma migrate deploy`.

2. **`20260627000000_setup_rls_role`** — creates the `app_user` role (if it does not already exist), grants it `SELECT / INSERT / UPDATE / DELETE` on all current and future tables, and revokes access to `_prisma_migrations`. This also runs as the DB owner during `prisma migrate deploy`.

After a fresh `prisma migrate reset` or `prisma migrate deploy`, both migrations run automatically and the database is fully configured.

> **Password note:** The migration creates `app_user` with the placeholder password `CHANGE_ME_STRONG_PASSWORD`. In production you must change this to a strong secret and set `DATABASE_URL` to use that password. The password lives only in your environment secrets — never commit it.

---

## Changing the app_user password after migration

The migration runs with a placeholder password. Before pointing `DATABASE_URL` at `app_user`, update the password in Postgres (connect as the owner):

```sql
ALTER ROLE app_user PASSWORD '<your-strong-secret>';
```

Then set `DATABASE_URL` in your environment:

```
DATABASE_URL=postgresql://app_user:<your-strong-secret>@<host>:5432/keepinv?schema=public
```

---

## Applying RLS to an existing database (manual path)

If your database was created before migration `20260627000000_setup_rls_role` was added, run the following as the DB owner to bring it up to date:

```bash
# Option A — let Prisma apply the pending migration (recommended)
bunx prisma migrate deploy

# Option B — apply the role setup manually (if Prisma migrations are locked or already marked applied)
psql -U postgres -d keepinv < prisma/rls-setup.sql
```

`prisma/rls-setup.sql` is the canonical source of truth for the role setup. The migration file is a copy of it so that fresh databases are configured automatically.

After applying, update the `app_user` password and set `DATABASE_URL` as described above, then set `ENFORCE_RLS=true` and restart the application.

---

## Verifying RLS is active

On application boot, `PrismaService` checks whether the connected role bypasses RLS. If `ENFORCE_RLS=true` and the role is a superuser or has `BYPASSRLS`, the app refuses to start with a clear error. Check the boot logs:

```
[PrismaConnection] WARNING — connected role bypasses RLS; tenant isolation is NOT enforced.
```

If you see this warning with `ENFORCE_RLS=true`, the app will exit. Confirm `DATABASE_URL` points at `app_user` (not `postgres`) and that the role was created correctly:

```sql
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app_user';
-- Expected: rolsuper=false, rolbypassrls=false
```

---

## Local development quick-start

For local development it is acceptable to connect as the superuser and leave `ENFORCE_RLS=false`. The RLS policies are still in place structurally; you just won't get the boot-time enforcement check.

```bash
cp .env.example .env
# Edit .env: set DATABASE_URL and DIRECT_URL to your local postgres superuser URL
bunx prisma migrate dev   # applies all migrations including RLS setup
bun prisma/seed.ts        # creates the platform admin
bun run start:dev
```

For a fully hardened local environment that mirrors production, create the `app_user` role locally, set `DATABASE_URL` to it, and set `ENFORCE_RLS=true`.
