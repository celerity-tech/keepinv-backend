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
