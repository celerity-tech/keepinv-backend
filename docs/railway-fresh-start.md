# Railway — quick deploy with fresh (zero) data

Goal: stand up this API on Railway with an **empty database**, then create the first
super-admin and the first organization. ~10 minutes.

The Docker image runs `prisma migrate deploy` on every boot, so a brand-new database is
schema-migrated automatically the first time the service starts. You only seed the admin and
create the org once.

> This is the **quick single-tenant** path (Rapido only): the app connects as the Postgres
> superuser and `ENFORCE_RLS` stays off. For multi-tenant isolation (many orgs in one DB),
> follow the hardened Row-Level-Security steps in `docs/public-deployment.md` +
> `prisma/rls-setup.sql` instead.

---

## 1. Provision a fresh Postgres

Pick one:

- **Cleanest — brand new DB:** in the Railway project, **+ New → Database → PostgreSQL**. If an
  old Postgres service exists and you want it gone, delete it first. A new plugin = zero data.
- **Reuse + wipe the existing DB:** keep the plugin, but reset it in step 5 with
  `prisma migrate reset` (drops everything, re-migrates, re-seeds).

---

## 2. Deploy the API service

- **+ New → GitHub Repo →** this repo. Railway detects the `Dockerfile` and builds it.
- Generate a public domain (Service → **Settings → Networking → Generate Domain**), or attach
  your custom domain (e.g. `assetwise-api.example.com`). Note it — it's your `APP_URL`.

---

## 3. Environment variables (API service → Variables)

```
NODE_ENV=production
PORT=8000
APP_URL=https://<your-api-domain>            # no trailing slash
DATABASE_URL=${{Postgres.DATABASE_URL}}      # Railway reference to the Postgres plugin
BETTER_AUTH_SECRET=<openssl rand -base64 32> # stable, 32+ chars
CORS_ALLOWED_ORIGINS=https://<your-frontend-domain>

# Product image upload (optional). The API key MUST have upload ("create") permission.
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
```

Notes:
- `${{Postgres.DATABASE_URL}}` is Railway's service-reference syntax — it injects the plugin's
  connection string (the `postgres` superuser). The Dockerfile runs migrations with it too
  (`DIRECT_URL` is unset, so it falls back to `DATABASE_URL`), which is fine for this quick path.
- Leave the `CLOUDINARY_*` vars unset and image upload simply returns 503 — the rest works.

Deploy. Watch the logs for `prisma migrate deploy` applying all migrations, then
`Nest application successfully started`. Verify:

```
curl https://<your-api-domain>/api/v1/health
```

---

## 4. Seed the first super-admin (once)

The boot step migrates but does **not** seed. Create the platform super-admin:

```bash
# From the repo, with the Railway CLI linked to this project (railway link):
railway run bun prisma/seed.ts
```

It prints the bootstrap credentials:

```
admin@keepinv.com / admin123   ← CHANGE THE PASSWORD AFTER FIRST LOGIN
```

(No CLI? Temporarily set the API service **Deploy command** to
`bun prisma/seed.ts && bun dist/src/main.js`, deploy once, then revert it.)

---

## 5. (Reuse path only) Wipe an existing DB to zero

If you reused an old database and want it empty, this drops all data, re-applies every
migration, and re-runs the seed:

```bash
railway run bunx prisma migrate reset --force
```

Skip this on a brand-new plugin — it's already empty.

---

## 6. Create the first organization (Rapido = PRO)

Log in as the super-admin to mint a session cookie, then create the org. The super-admin is
org-less, so use the API directly:

```bash
API=https://<your-api-domain>/api/v1

# 1) Sign in (saves the session cookie to cookies.txt)
curl -c cookies.txt -X POST "$API/auth/sign-in/email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@keepinv.com","password":"admin123"}'

# 2) Create the PRO org + its owner account
curl -b cookies.txt -X POST "$API/platform/organizations" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Rapido Motorsiklo",
    "plan": "PRO",
    "printerType": "NIIMBOT",
    "trialDays": 0,
    "admin": { "name": "Rapido Owner", "email": "owner@rapido.test", "password": "changeme123" }
  }'
```

- `plan: "PRO"` unlocks POS **and** the Barcode Sheet feature.
- `trialDays: 0` = subscribed (never locked). Use `7` for a trial.
- `printerType: "NIIMBOT"` enables label printing; use `"NONE"` if not printing labels.

The `owner@rapido.test` account is what the client logs into the frontend with.

---

## 7. Point the frontend at this API

In the frontend repo, set `src/environments/environment.prod.ts`:

```ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://<your-api-domain>/api/v1',
};
```

Make sure `CORS_ALLOWED_ORIGINS` (step 3) lists the frontend's domain, then build/deploy the
frontend (Vercel, Railway static, etc.).

---

## Is `migrate deploy` on boot best practice?

Short answer: **fine for this setup, with caveats.**

- ✅ Good for a single instance (Railway default = 1 replica): zero-step deploys, schema is
  always current before the app serves traffic.
- ✅ The Dockerfile already separates concerns the right way — migrations can run as the DB
  **owner** via `DIRECT_URL`, while the app serves as the least-privilege role via
  `DATABASE_URL`. (In this quick path both are the same superuser; that separation matters once
  you adopt `app_user`/RLS.)
- ⚠️ **Multiple replicas** would race on startup. Prisma takes a migration advisory lock so it's
  usually safe, but it's not ideal.
- ⚠️ A **failing migration crash-loops** the container instead of failing one clean release step.

Best practice at larger scale: run `prisma migrate deploy` as a **separate release/CI step**
(or a one-off Railway job) *before* rolling the app, and let the app boot assuming the schema is
ready. For one Rapido instance on Railway, on-boot is perfectly acceptable — revisit it only when
you scale past one replica.

---

## ELI5: full reset & redeploy (when your prod runs `app_user` + RLS)

Use this if your API logs in as the least-privilege **`app_user`** (not the superuser). Tell-tale
sign: after a reset, logins fail with `permission denied for schema public` (SQLSTATE `42501`).
That's RLS-grade prod — every reset needs the grants re-applied.

Think of it as rebuilding a shop, in order. Each step says **what** and **why**.

### 0. Take a photo first (backup)
Dashboard → **Postgres → Backups → Create**. If anything goes wrong, you can roll back.

### 1. Empty the shop, put the shelves back (reset)
```powershell
railway run bunx prisma migrate reset --force
```
Deletes ALL data, rebuilds every table, re-enables the security locks (RLS), and recreates the
admin `admin@keepinv.com` / `admin123`.
⚠️ It rebuilds the `public` schema from scratch, which **throws away `app_user`'s keys** → step 2.

### 2. Give the worker its keys back (re-grant `app_user`)
The app's container has no `psql`, so apply `rls-setup.sql` with `bun` instead:
```powershell
railway ssh
```
Then paste inside the container (`/app #`):
```sh
cat > /tmp/apply-rls.mjs <<'SCRIPT'
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
const url = process.argv[2];                      // the postgres OWNER url
const sql = readFileSync('/app/prisma/rls-setup.sql', 'utf8');
const pool = new Pool({ connectionString: url });
const c = await pool.connect();
try {
  await c.query(sql);
  const r = await c.query("select has_schema_privilege('app_user','public','USAGE') a, has_table_privilege('app_user','users','SELECT') b, has_table_privilege('app_user','products','INSERT') c");
  console.log('grants:', r.rows[0]);
} finally { c.release(); await pool.end(); }
SCRIPT
bun /tmpa/pply-rls.mjs "<OWNER_DATABASE_URL>"
```
`<OWNER_DATABASE_URL>` = the **postgres** (superuser) string from Railway → Postgres → **Variables**
(`DATABASE_PUBLIC_URL`). NOT `app_user`. Want `grants: { a: true, b: true, c: true }`, then `exit`.

> Why bun and not `psql`/`prisma db execute`? The `oven/bun:alpine` image has no `psql`, and
> Prisma 7's `db execute` dropped `--url` (it reads `prisma.config.ts` → `app_user`, which can't
> `GRANT`). The `bun`+`pg` one-off connects as the owner and runs the `DO $$` block directly.

### 3. Wake the worker up (restart the API)
Dashboard → API service → **Restart**. It reconnects with working grants — `42501` is gone.

### 4. Hire the boss (create the org)
The reset deleted all organizations. Recreate Rapido (sign in as admin, then the org-create call
in section 6 above). Copy the new org **id**.

### 5. Stock the shelves (seed products)
```powershell
$env:RAPIDO_ORG_ID="<paste-org-id>"; railway run bun prisma/seed-motorshop-products.ts
```
Want: `Seeded 39 categories and 452 products.` (The org must exist first — step 4 — or the FK insert fails.)

### 6. Change the locks (admin password)
Sign in and change `admin123`.

### The one rule
**Every `migrate reset` → re-run step 2.** Reset rebuilds `public` and wipes `app_user`'s grants;
skip the re-grant and the next login throws `permission denied for schema public`.

| Step | Command | Want to see |
|------|---------|-------------|
| 1 reset | `railway run bunx prisma migrate reset --force` | `Applying migration …` + admin created |
| 2 grants | `railway ssh` → bun apply-rls.mjs | `{ a: true, b: true, c: true }` |
| 3 restart | dashboard → Restart | login works |
| 4 org | sign in → create org | org `id` |
| 5 seed | `railway run bun prisma/seed-motorshop-products.ts` | `Seeded 39 categories and 452 products.` |
| 6 password | change in app | — |
