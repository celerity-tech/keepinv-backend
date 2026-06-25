# Deploy Handoff — Geoplan (internal build)

This is the **Geoplan** branch: single-tenant, internal. Same code as the public product minus the
subscription trial/lock surface. Deploy it however you like — but **three things are app-specific and
you will not infer them from the compose file.** Read these first.

Stack: Docker Compose — **Postgres + NestJS API + Caddy** (auto-HTTPS). See `docker-compose.prod.yml`,
`Caddyfile`. Secrets go in a server `.env` (never committed). Health: `GET /api/v1/health` (anonymous).

---

## 1. RLS bootstrap is manual, ONCE — or the API crash-loops

The app connects as a least-privilege Postgres role **`app_user`** (so Row-Level Security is actually
enforced; `ENFORCE_RLS=true` makes the app refuse to boot otherwise). That role is created by
`prisma/rls-setup.sql`, which is **NOT automated**. The Dockerfile auto-runs `prisma migrate deploy`
(as the owner via `DIRECT_URL`) on boot, but if `app_user` doesn't exist yet the API connects as it,
fails, and restarts forever.

First-boot order (run once):
```bash
COMPOSE="docker compose -f docker-compose.prod.yml"
OWNER="postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/asset_wise?schema=public"

$COMPOSE up -d db                                                       # wait until healthy
$COMPOSE run --rm -e DATABASE_URL="$OWNER" api bunx prisma migrate deploy   # create tables (as owner)
$COMPOSE exec -T db psql -U postgres -d asset_wise < prisma/rls-setup.sql   # create app_user + grants
$COMPOSE run --rm -e DATABASE_URL="$OWNER" api bun prisma/seed.ts           # seed SUPER_ADMIN (see #2)
$COMPOSE up -d --build                                                  # API now boots as app_user
```
Set the `app_user` password in `rls-setup.sql` to match `DATABASE_URL`. After this, every later boot
auto-applies new migrations — no manual step.

---

## 2. The org + first admin are NOT auto-created — provision via API

Seeding (`bun prisma/seed.ts`, step above) creates only the platform **SUPER_ADMIN**
(`admin@geoplan.ph` / `admin123` — change the password after first login). The actual tenant is
created manually. In Postman (**enable the cookie jar** — auth uses an httpOnly session cookie):

```
POST {API}/api/v1/auth/sign-in/email
{ "email": "admin@geoplan.ph", "password": "<changed-password>" }

POST {API}/api/v1/platform/organizations
{ "name": "Geoplan", "plan": "BASIC", "printerType": "NONE",
  "admin": { "name": "Geoplan Admin", "email": "owner@geoplan.ph", "password": "<min 8 chars>" } }
```
Plan `BASIC` = Inventory only (no POS). Without this step there is no tenant and no one can log in.

---

## 3. Cookie/domain + required env

The session cookie is `SameSite=None; Secure` in prod. The frontend (Vercel) and this API **must be on
the same root domain** (e.g. `geoplan.<domain>` + `geoplan-api.<domain>`), or browsers block the cookie
and **login won't persist**. Set `CORS_ALLOWED_ORIGINS` to the exact frontend origin.

`.env` (chmod 600):
```ini
NODE_ENV=production
PORT=8000
APP_URL=https://<api-domain>
DATABASE_URL=postgresql://app_user:<APP_USER_PASSWORD>@db:5432/asset_wise?schema=public   # runtime, RLS
DIRECT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/asset_wise?schema=public      # migrations only
ENFORCE_RLS=true
BETTER_AUTH_SECRET=<32+ char secret>
CORS_ALLOWED_ORIGINS=https://<frontend-origin>
POSTGRES_PASSWORD=<POSTGRES_PASSWORD>
```
Edit `Caddyfile`: set the real `email` and the API domain.

**Frontend:** separate repo `asset-wise-frontend`, branch **`geoplan`** (trial/lock UI stripped). Set
`src/environments/environment.prod.ts` → `apiBaseUrl: 'https://<api-domain>/api/v1'`, deploy on Vercel,
add the matching custom domain.

---

## Verify

```bash
docker compose -f docker-compose.prod.yml logs -f api    # NO "[PrismaConnection] WARNING"
curl https://<api-domain>/api/v1/health                  # {"status":"ok",...} over valid TLS
```
Then log in as the Geoplan owner from the frontend and confirm the session persists.
