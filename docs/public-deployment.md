# Public + Rapido Deployment — this repo (Hostinger VPS KVM 2)

This repo (`asset-wise-backend`, the **main**) is the **public SaaS + Rapido** deployment:
multi-tenant, one Postgres shared via Row-Level Security, every customer is a row in `organizations`.
Hosted on a Hostinger KVM 2 VPS. Geoplan is **not** here — it runs from its own repo/VPS (see
`docs/geoplan-deployment.md`).

Stack runs as Docker Compose: **Postgres + NestJS API + Caddy** (auto-HTTPS). Files:
`docker-compose.prod.yml`, `Caddyfile` (repo root). Secrets live in a server `.env` — never committed.

## Plans (module-based)

| Plan | Modules | RFID | Barcode | Label printing |
|---|---|---|---|---|
| **BASIC** | Inventory only | ✅ | ✅ | by `printerType` |
| **PRO** | POS **+** Inventory | ✅ | ✅ | by `printerType` |

- **Rapido → PRO** (sells + inventory), `printerType=NIIMBOT`, subscribed (no trial).
- Public customers → typically **BASIC** with a 7-day trial, upgraded on payment.
- RFID & barcode are on **both** plans. Label printing depends only on `printerType`.
- Trial: `trialEndsAt=null` ⇒ subscribed (never locked); future date ⇒ trial running; past date ⇒
  **locked** → frontend trial-ended screen with a Facebook CTA (hardcoded in `locked.ts`).

Surfaced to the frontend by `GET /api/v1/entitlements`:
`{ plan, printerType, trialEndsAt, trialActive, trialExpired, locked, features:{inventory,pos,rfid,labelPrinting} }`.

---

## 0. Decide your domains FIRST (avoids an auth rebuild later)

Better Auth's session cookie is `SameSite=None; Secure` in prod. If the Vercel frontend and this API
are on **different root domains**, the cookie is third-party and modern browsers may block it → users
can't stay logged in. **Put both on the same root domain:**
- Frontend (Vercel): `app.acethekawaii.work`
- Backend (this VPS): `api.acethekawaii.work`

The guide assumes `api.acethekawaii.work`; change it consistently in `Caddyfile`, `.env`, and the
frontend `apiBaseUrl` if you use something else.

---

## 1. DNS

A record: `api.acethekawaii.work → <VPS public IP>`. Point the Vercel frontend domain
(`app.acethekawaii.work`) per Vercel's UI. Verify: `dig +short api.acethekawaii.work`.

---

## 2. Harden the VPS (run as root once)

```bash
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
timedatectl set-timezone Asia/Manila
apt update && apt -y upgrade
apt -y install fail2ban unattended-upgrades ufw
dpkg-reconfigure -plow unattended-upgrades
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
```
Disable root + password SSH (`/etc/ssh/sshd_config`: `PermitRootLogin no`, `PasswordAuthentication no`),
`systemctl restart ssh`, then **confirm `ssh deploy@<IP>` in a NEW terminal before closing root.**

> Postgres 5432 is intentionally **not** opened — the DB binds to `127.0.0.1` only.

---

## 3. Install Docker (as `deploy`)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
sudo systemctl enable --now docker
docker --version && docker compose version
```

---

## 4. Get the code + create `.env`

```bash
cd ~ && git clone <main-repo-url> asset-wise-backend && cd asset-wise-backend
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 24   # Postgres + app_user passwords
```

**Set the app_user password** in `prisma/rls-setup.sql` (the `CREATE ROLE app_user ... PASSWORD`
line, default `'acethekawaii'`) to a strong value — it must match `DATABASE_URL`.

Create `~/asset-wise-backend/.env` (then `chmod 600 .env`):
```ini
NODE_ENV=production
PORT=8000
APP_URL=https://api.acethekawaii.work

# Runtime = least-privilege app_user (RLS enforced). Multiple tenants share this DB — keep RLS on.
DATABASE_URL=postgresql://app_user:<APP_USER_PASSWORD>@db:5432/asset_wise?schema=public
# Owner role — migrations (DDL + RLS) only.
DIRECT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/asset_wise?schema=public
ENFORCE_RLS=true

BETTER_AUTH_SECRET=<32+ char secret>
CORS_ALLOWED_ORIGINS=https://app.acethekawaii.work
POSTGRES_PASSWORD=<POSTGRES_PASSWORD>
```

Edit `Caddyfile` — set your real `email` and the `api.acethekawaii.work` domain.

---

## 5. First-time database bootstrap (order matters)

`app_user` must exist **before** the full stack boots. Run once, in order:

```bash
cd ~/asset-wise-backend
COMPOSE="docker compose -f docker-compose.prod.yml"
OWNER="postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/asset_wise?schema=public"

$COMPOSE up -d db && $COMPOSE ps                       # wait for db = healthy
$COMPOSE run --rm -e DATABASE_URL="$OWNER" api bunx prisma migrate deploy   # schema + RLS as owner
$COMPOSE exec -T db psql -U postgres -d asset_wise < prisma/rls-setup.sql   # create app_user + grants
$COMPOSE run --rm -e DATABASE_URL="$OWNER" api bun prisma/seed.ts           # SUPER_ADMIN (admin@geoplan.ph / admin123)
$COMPOSE up -d --build                                 # API boots as app_user; Caddy provisions HTTPS
```

> On every later boot the API re-runs `prisma migrate deploy` (as owner) automatically.

---

## 6. Verify

```bash
docker compose -f docker-compose.prod.yml ps             # all up; api healthy
docker compose -f docker-compose.prod.yml logs -f api    # NO "[PrismaConnection] WARNING"
curl https://api.acethekawaii.work/api/v1/health         # {"status":"ok",...} over valid TLS
```

---

## 7. Provision organizations (Postman)

**Turn on Postman's cookie jar.** `{API}` = `https://api.acethekawaii.work`.

**7.1 — Sign in as SUPER_ADMIN** (change the seeded password after first login)
```
POST {API}/api/v1/auth/sign-in/email
{ "email": "admin@geoplan.ph", "password": "<your-changed-password>" }
```

**7.2 — Create Rapido** (PRO, POS + Inventory, Niimbot, subscribed). **Capture `organization.id`** —
you need it to seed Rapido's products later. Use a distinct owner email.
```
POST {API}/api/v1/platform/organizations
{
  "name": "Rapido Motorsiklo Garage",
  "plan": "PRO",
  "printerType": "NIIMBOT",
  "trialDays": 0,
  "admin": { "name": "Rapido Owner", "email": "owner@rapido.ph", "password": "<min 8 chars>" }
}
```
> ⚠️ **Slug collision:** an old migration may seed an empty `rapido-motorsiklo-garage` org. If this
> POST returns 409, drop that stray row (no data on a fresh DB), then retry:
> `DELETE FROM organizations WHERE slug='rapido-motorsiklo-garage';`
> (or pass a different `"slug"` in the body). Confirm with `SELECT id, slug, plan FROM organizations;`.

**7.3 — A public customer with a 7-day trial** (later, when someone messages you)
```
POST {API}/api/v1/platform/organizations
{ "name": "Some Shop", "plan": "BASIC", "admin": {...} }   // trialDays omitted -> defaults to 7
```
When their 7 days elapse they're auto-locked → trial-ended screen → your FB CTA. After they pay:
```
PATCH {API}/api/v1/platform/organizations/{orgId}
{ "trialDays": 0 }     // clears the trial = subscribed; they must re-login to refresh
```

---

## 7b. Seed Rapido's product catalog (when Rapido goes live)

Rapido's initial items come from `prisma/seed-motorshop-products.ts`, which reads the target org from
**`RAPIDO_ORG_ID`** (the id captured in 7.2). Run inside the api container as the owner:
```bash
docker compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/asset_wise?schema=public" \
  -e RAPIDO_ORG_ID="<rapido-org-id>" \
  api bun prisma/seed-motorshop-products.ts
```
Idempotent (upserts by `organizationId + sku`); quantities start at 0.

---

## 8. Operator cheat-sheet (PATCH)

`PATCH /api/v1/platform/organizations/{orgId}` — send only what changes:
| Goal | Body |
|---|---|
| Upgrade to POS | `{ "plan": "PRO" }` |
| Downgrade | `{ "plan": "BASIC" }` |
| Set/refresh printer | `{ "printerType": "NIIMBOT" }` |
| Mark subscribed (clear trial) | `{ "trialDays": 0 }` |
| Start/extend a trial | `{ "trialDays": 7 }` |
| Force a trial end (testing) | `{ "trialEndsAt": "2020-01-01T00:00:00.000Z" }` (past ⇒ locked) |
| Suspend a tenant | `{ "isActive": false }` (locks them) |
| Reactivate | `{ "isActive": true }` |

Changes take effect on the user's **next login / entitlements refresh**. The org-less SUPER_ADMIN
always resolves to full PRO access and is never locked.

---

## 9. Frontend (Vercel)

Set `src/environments/environment.prod.ts` → `apiBaseUrl: 'https://api.acethekawaii.work/api/v1'`,
commit, let Vercel build, add the custom domain `app.acethekawaii.work`. Confirm `CORS_ALLOWED_ORIGINS`
matches that exact origin. Test login end-to-end (cookie must persist — see §0).

---

## 10. Backups (do NOT skip)

Daily `pg_dump`, kept 14 days. `~/asset-wise-backend/backup.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
DIR=/home/deploy/backups; mkdir -p "$DIR"; STAMP=$(date +%F_%H%M)
docker compose -f /home/deploy/asset-wise-backend/docker-compose.prod.yml exec -T db \
  pg_dump -U postgres asset_wise | gzip > "$DIR/asset_wise_$STAMP.sql.gz"
find "$DIR" -name 'asset_wise_*.sql.gz' -mtime +14 -delete
```
```bash
chmod +x backup.sh && crontab -e
# 30 2 * * * /home/deploy/asset-wise-backend/backup.sh >> /home/deploy/backups/backup.log 2>&1
```
**Push backups offsite** (rclone → B2/Drive, or scp) and **test one restore**:
```bash
gunzip -c backups/asset_wise_<stamp>.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U postgres -d asset_wise
```

---

## 11. Updates & hygiene

```bash
cd ~/asset-wise-backend && git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```
Migrations apply on API boot. Do once: 2G swapfile + Docker log rotation
(`/etc/docker/daemon.json` → `max-size 10m, max-file 3`, then restart docker).

---

## 12. Smoke test

1. Boot: no RLS warning in logs.
2. `GET /api/v1/entitlements` as Rapido owner → `plan:PRO, features.pos:true, printerType:NIIMBOT`; POS + print button visible.
3. **Trial-expiry test:** create a test BASIC org, `PATCH {orgId} { "trialEndsAt": "2020-01-01T00:00:00.000Z" }`, re-login as that owner → lock screen + Facebook CTA. Restore with `{ "trialDays": 0 }`.

---

## Known follow-ups (NOT blocking go-live)

- **Gating is frontend-only.** A BASIC user could still call POS APIs directly. Before untrusted
  public BASIC customers, add a backend `@RequireFeature('pos')` guard + a trial-lock guard on tenant
  routes. Fine for trusted clients (Rapido); a real risk once strangers self-serve.
- **Entitlements refresh only on login/app start.** After a PATCH, the user must re-login to see it.
- **Per-instance frontend env.** Geoplan is already a separate repo/build; any further split needs its
  own Angular build config with that API's `apiBaseUrl`.
