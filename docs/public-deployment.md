# Deploy the Keepinv Backend to your VPS (step-by-step)

This guide deploys **only the backend** (`keepinv-backend`) to your Hostinger VPS. The **frontend
runs on Vercel** — it is NOT installed here. You will point the frontend at this backend *after* the
backend is live (see §9).

**What actually runs on the VPS** (all via Docker Compose, defined in `docker-compose.prod.yml` +
`Caddyfile` at the repo root):

1. **Postgres** — the database. One shared database; each customer is a row in `organizations`,
   isolated by Row-Level Security (RLS). Only this server can reach it (never exposed to the internet).
2. **NestJS API** — the actual backend app, listening on port `8000` *inside* Docker.
3. **Caddy** — a reverse proxy that takes public web traffic on ports `80`/`443`, gets a free HTTPS
   certificate automatically, and forwards requests to the API.

> Product images are stored on **Cloudinary** (already wired into this repo). There is **no S3 / no
> file storage** to set up — you only paste 3 Cloudinary keys into `.env` (§4).

**Logged-in user on the VPS:** `ace` (the account in your screenshot). Every path below is under
`/home/ace`. **Code lives in:** `~/repos/keepinv-backend`.

---

## Plans (what each customer gets)

| Plan | Modules | RFID | Barcode | Label printing |
|---|---|---|---|---|
| **BASIC** | Inventory only | ✅ | ✅ | depends on `printerType` |
| **PRO** | POS **+** Inventory | ✅ | ✅ | depends on `printerType` |

- **Rapido → PRO** (sells + inventory), `printerType=NIIMBOT`, subscribed (no trial).
- Public customers → usually **BASIC** with a 7-day trial, upgraded after they pay.
- RFID & barcode are on **both** plans. Label printing depends only on `printerType`.
- Trial logic (`trialEndsAt`): `null` = subscribed forever (never locked); future date = trial running;
  past date = **locked** → frontend shows the trial-ended screen with a Facebook CTA.

The frontend reads all this from `GET /api/v1/entitlements`:
`{ plan, printerType, trialEndsAt, trialActive, trialExpired, locked, features:{inventory,pos,rfid,labelPrinting} }`.
 
---

## 0. Domain plan (read this once so the names make sense)

Everything lives under the **`keepinv.com`** root (already in your Cloudflare account):

| Name | Points to | Purpose |
|---|---|---|
| `api.keepinv.com` | **This VPS** | The backend — what this guide deploys. |
| `app.keepinv.com` | Vercel | The frontend app. Wire up *after* backend is live (§9). |
| `keepinv.com` (apex) | Vercel | Marketing/landing page. Not needed for go-live; do it whenever. |

**Why app + api share the `keepinv.com` root:** the login session cookie is `SameSite=None; Secure`.
If frontend and backend were on *different* root domains, browsers treat the cookie as third-party and
may block it → users get logged out. Same root domain = the cookie is trusted and login sticks.

If you ever change `api.keepinv.com` to something else, change it in **all three** places:
`Caddyfile`, the server `.env`, and the frontend's `apiBaseUrl`.

---

## 1. DNS in Cloudflare

Add **one** record so `api.keepinv.com` resolves to your VPS:

- **Type:** `A`
- **Name:** `api`
- **IPv4 address:** `<your VPS public IP>`
- **Proxy status:** **DNS only (grey cloud)** ← important, see below

> **Why grey cloud, not orange?** Caddy gets and serves its *own* HTTPS certificate (Let's Encrypt).
> For that it must talk to the real internet on ports 80/443. If the record is **proxied (orange
> cloud)**, Cloudflare sits in front and handles TLS itself, which blocks Caddy's certificate request
> and causes redirect/cert errors. **Grey cloud** = Cloudflare only translates the name to your IP and
> stays out of the way. (You can switch to orange later once you understand the trade-offs.)

**Verify it points at YOUR server (not Cloudflare):**
```bash
dig +short api.keepinv.com      # must return your VPS IP, e.g. 203.0.113.10
```
If it returns a `104.x` / `172.x` address, the proxy is still ON — switch that record to grey cloud.

> `app.keepinv.com` and the apex are configured later (§9) following Vercel's instructions. Skip for now.

---

## 2. Harden the VPS (run once, as `ace` with `sudo`)

You're already the `ace` user (has sudo). No new user needed. Skip anything you've already done.

```bash
sudo timedatectl set-timezone Asia/Manila
sudo apt update && sudo apt -y upgrade
sudo apt -y install fail2ban unattended-upgrades ufw   # fail2ban: blocks brute-force; unattended-upgrades: auto security patches
sudo dpkg-reconfigure -plow unattended-upgrades        # choose "Yes"

# Firewall: allow SSH + web only, block everything else
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

**Lock down SSH** (so only your key can log in). Edit `/etc/ssh/sshd_config`:
```
PermitRootLogin no
PasswordAuthentication no
```
Then `sudo systemctl restart ssh`.

> ⚠️ Before you close this session: open a **new** terminal and confirm `ssh ace@<VPS-IP>` still works
> with your key. If it doesn't, you'd lock yourself out.

> Postgres port `5432` is **never** opened in the firewall on purpose — the database only listens on
> `127.0.0.1` (localhost) and is reached privately by the API inside Docker.

---

## 3. Install Docker (as `ace`)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker   # lets you run docker without sudo
sudo systemctl enable --now docker
docker --version && docker compose version       # both should print versions
```

---

## 4. Get the code + create the `.env`

```bash
mkdir -p ~/repos && cd ~/repos
git clone https://github.com/celerity-tech/keepinv-backend.git
cd keepinv-backend
```
You're now in `~/repos/keepinv-backend` — this is the project folder for every command below.

**Generate the secrets you'll paste into `.env`:**
```bash
openssl rand -base64 32   # use for BETTER_AUTH_SECRET
openssl rand -base64 24   # use for POSTGRES_PASSWORD
openssl rand -base64 24   # use for the app_user (DATABASE_URL) password
```

**Set the app_user password in the SQL file.** Open `prisma/rls-setup.sql`, find the line
`CREATE ROLE app_user ... PASSWORD 'CHANGE_ME_STRONG_PASSWORD'` and replace it with the 3rd secret
above. **This must match the password you put in `DATABASE_URL`.**

**Create the env file** `~/repos/keepinv-backend/.env`, then lock its permissions with `chmod 600 .env`:
```ini
NODE_ENV=production
PORT=8000
APP_URL=https://api.keepinv.com

# Runtime DB user = least-privilege app_user (RLS enforced, so tenants stay isolated).
# Host is "db" because that's the Postgres service name inside Docker.
DATABASE_URL=postgresql://app_user:<APP_USER_PASSWORD>@db:5432/keepinv?schema=public

# Owner/superuser role — used ONLY to run migrations (create tables + turn on RLS).
DIRECT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/keepinv?schema=public

# Refuse to boot if the runtime role could bypass RLS. Keep true in production.
ENFORCE_RLS=true

# Login session signing secret (the first openssl output).
BETTER_AUTH_SECRET=<32+ char secret>

# Only the frontend origin may call this API from a browser.
CORS_ALLOWED_ORIGINS=https://app.keepinv.com

# Postgres container password (the second openssl output).
POSTGRES_PASSWORD=<POSTGRES_PASSWORD>

# --- Product image uploads (Cloudinary) ---
# Get these from the Cloudinary dashboard: Settings > API Keys.
# The API key MUST have upload ("create") permission, or uploads return 403.
# (Leave blank to disable image upload — the endpoint returns 503, rest of app works.)
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
```

**Edit `Caddyfile`** — make sure the email and domain are correct (they should already say
`admin@keepinv.com` and `api.keepinv.com`). Caddy uses the email for the HTTPS certificate.

---

## 5. First-time database setup (do this once, IN ORDER)

The `app_user` role must exist **before** the full app starts, so we bring up the database first and
prepare it. Run these one at a time, in this exact order:

```bash
cd ~/repos/keepinv-backend
COMPOSE="docker compose -f docker-compose.prod.yml"
OWNER="postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/keepinv?schema=public"

# 1) Start ONLY the database, then check it's healthy before continuing
$COMPOSE up -d db && $COMPOSE ps

# 2) Create the tables + enable RLS (run as the owner role)
$COMPOSE run --rm -e DATABASE_URL="$OWNER" api bunx prisma migrate deploy

# 3) Create the limited app_user role + its grants
$COMPOSE exec -T db psql -U postgres -d keepinv < prisma/rls-setup.sql

# 4) Seed the first admin account (SUPER_ADMIN: admin@keepinv.com / admin123)
$COMPOSE run --rm -e DATABASE_URL="$OWNER" api bun prisma/seed.ts

# 5) Build + start everything. API now runs as app_user; Caddy fetches HTTPS automatically.
$COMPOSE up -d --build
```

> On every future restart, the API automatically re-runs `prisma migrate deploy` (as the owner), so
> new migrations apply on their own.

---

## 6. Verify it's live

```bash
docker compose -f docker-compose.prod.yml ps             # every service "Up"; api shows healthy
docker compose -f docker-compose.prod.yml logs -f api    # should NOT contain "[PrismaConnection] WARNING"
curl https://api.keepinv.com/api/v1/health               # {"status":"ok",...} over valid HTTPS
```
If the `curl` returns ok over HTTPS, the backend is deployed. 🎉

> First HTTPS request can take ~30s while Caddy gets the certificate. If it fails, re-check that the
> `api` DNS record is grey cloud (§1) and that ports 80/443 are open (§2).

---

## 7. Create organizations (using Postman)

**Turn ON Postman's cookie jar** (login uses a session cookie). Set `{API} = https://api.keepinv.com`.

**7.1 — Sign in as SUPER_ADMIN** (then change this password after first login):
```
POST {API}/api/v1/auth/sign-in/email
{ "email": "admin@keepinv.com", "password": "admin123" }
```

**7.2 — Create Rapido** (PRO, POS + Inventory, Niimbot, subscribed). **Copy the returned
`organization.id`** — you need it to seed Rapido's products in §7b. Use a real owner email.
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
> ⚠️ If this returns **409 (conflict)**, an old migration may have left an empty
> `rapido-motorsiklo-garage` org. On a fresh DB it has no data — delete it and retry:
> `DELETE FROM organizations WHERE slug='rapido-motorsiklo-garage';`
> (or pass a different `"slug"` in the body). Check with `SELECT id, slug, plan FROM organizations;`.

**7.3 — A public customer on a 7-day trial** (later, when someone signs up):
```
POST {API}/api/v1/platform/organizations
{ "name": "Some Shop", "plan": "BASIC", "admin": {...} }   // no trialDays -> defaults to 7
```
When their 7 days run out they're auto-locked → trial-ended screen → your FB CTA. After they pay:
```
PATCH {API}/api/v1/platform/organizations/{orgId}
{ "trialDays": 0 }     // clears the trial = subscribed. They must re-login to refresh.
```

---

## 7b. Seed Rapido's products (when Rapido goes live)

Rapido's starting catalog comes from `prisma/seed-motorshop-products.ts`. It needs the org id from
§7.2 via `RAPIDO_ORG_ID`. Run it inside the api container as the owner role:
```bash
docker compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/keepinv?schema=public" \
  -e RAPIDO_ORG_ID="<rapido-org-id>" \
  api bun prisma/seed-motorshop-products.ts
```
Safe to re-run (upserts by `organizationId + sku`); quantities start at 0.

---

## 8. Operator cheat-sheet (changing a customer later)

`PATCH /api/v1/platform/organizations/{orgId}` — send only the field you're changing:

| Goal | Body |
|---|---|
| Upgrade to POS | `{ "plan": "PRO" }` |
| Downgrade | `{ "plan": "BASIC" }` |
| Set/refresh printer | `{ "printerType": "NIIMBOT" }` |
| Mark subscribed (clear trial) | `{ "trialDays": 0 }` |
| Start/extend a trial | `{ "trialDays": 7 }` |
| Force a trial end (testing) | `{ "trialEndsAt": "2020-01-01T00:00:00.000Z" }` (past date ⇒ locked) |
| Suspend a tenant | `{ "isActive": false }` (locks them) |
| Reactivate | `{ "isActive": true }` |

Changes take effect on the user's **next login / entitlements refresh**. The SUPER_ADMIN always has
full PRO access and is never locked.

---

## 9. Point the frontend at this backend (do AFTER backend is live)

The frontend is already built on Vercel. Only two things remain:

1. In the frontend repo, set `src/environments/environment.prod.ts` →
   `apiBaseUrl: 'https://api.keepinv.com/api/v1'`, commit, let Vercel rebuild.
2. In Vercel, add the custom domain **`app.keepinv.com`** and follow Vercel's DNS instructions
   (usually a `CNAME` you add in Cloudflare — keep that record **DNS only / grey cloud** too).
   Add the apex `keepinv.com` for marketing whenever you're ready.

Confirm `CORS_ALLOWED_ORIGINS=https://app.keepinv.com` in the server `.env` matches exactly, then test
login end-to-end (the session cookie must stick — see §0).

---

## 10. Backups (do NOT skip)

Daily `pg_dump`, kept 14 days. Create `~/repos/keepinv-backend/backup.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
DIR=/home/ace/backups; mkdir -p "$DIR"; STAMP=$(date +%F_%H%M)
docker compose -f /home/ace/repos/keepinv-backend/docker-compose.prod.yml exec -T db \
  pg_dump -U postgres keepinv | gzip > "$DIR/keepinv_$STAMP.sql.gz"
find "$DIR" -name 'keepinv_*.sql.gz' -mtime +14 -delete
```
Schedule it:
```bash
chmod +x backup.sh && crontab -e
# add this line (runs daily at 02:30):
# 30 2 * * * /home/ace/repos/keepinv-backend/backup.sh >> /home/ace/backups/backup.log 2>&1
```
**Also copy backups off the server** (rclone → Backblaze B2 / Google Drive, or `scp`) and **test one
restore** so you know it works:
```bash
gunzip -c /home/ace/backups/keepinv_<stamp>.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U postgres -d keepinv
```

---

## 11. Updating the backend later

```bash
cd ~/repos/keepinv-backend && git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```
Migrations apply automatically on API boot. **One-time tuning:** add a 2 GB swapfile and turn on Docker
log rotation (`/etc/docker/daemon.json` → `{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}`,
then `sudo systemctl restart docker`).

---

## 12. Final smoke test

1. Logs show **no RLS warning** on boot.
2. `GET /api/v1/entitlements` as the Rapido owner → `plan:PRO`, `features.pos:true`,
   `printerType:NIIMBOT`; POS + print button visible in the app.
3. **Trial-expiry test:** create a test BASIC org, `PATCH {orgId} { "trialEndsAt": "2020-01-01T00:00:00.000Z" }`,
   re-login as that owner → you should see the lock screen + Facebook CTA. Restore with `{ "trialDays": 0 }`.
4. Upload a product image → it lands on Cloudinary and the image URL returns.

---

## Known limitations (NOT blocking go-live)

- **Plan gating is frontend-only.** A BASIC user could still call POS APIs directly. Before letting
  *untrusted strangers* self-serve, add a backend `@RequireFeature('pos')` guard + a trial-lock guard
  on tenant routes. Fine for trusted clients like Rapido; a real risk once strangers self-serve.
- **Entitlements refresh only on login/app start.** After a PATCH, the user must re-login to see it.
- **Frontend env is per-build.** Any future split needs its own Vercel build with that API's `apiBaseUrl`.
