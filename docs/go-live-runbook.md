# Go-Live Runbook — Geoplan + Rapido (single Railway instance)

One codebase, **one deployment on Railway**, shared Postgres + RLS. Both tenants are rows in
`organizations`. No VPS / separate DB until a client actually requires isolation.

## Plans (module-based)

| Plan | Modules | RFID | Barcode | Label printing |
|---|---|---|---|---|
| **BASIC** | Inventory only | ✅ | ✅ | by `printerType` |
| **PRO** | POS **+** Inventory | ✅ | ✅ | by `printerType` |

- **Rapido → PRO** (sells + inventory), `printerType=NIIMBOT`, subscribed (no trial).
- **Geoplan → BASIC** (inventory only, doesn't sell), `printerType=NONE`, subscribed (no trial).
- RFID & barcode are on **both** plans. Label printing depends only on `printerType`, not the plan.
- Trial: `trialEndsAt=null` ⇒ subscribed (never locked). A future date ⇒ trial running. A past date ⇒
  **locked** → frontend shows the trial-ended screen with a CTA to your Facebook page (hardcoded in
  `locked.ts`, `SUBSCRIBE_URL`).

Surfaced to the frontend by `GET /api/v1/entitlements`:
`{ plan, printerType, trialEndsAt, trialActive, trialExpired, locked, features:{inventory,pos,rfid,labelPrinting} }`.

---

## 0. Prereqs (once)

1. **Apply migrations** (adds `plan`/`printerType`/`trialEndsAt`). Auto-runs on Docker boot; or manually:
   ```bash
   bun prisma migrate deploy
   ```
2. **SUPER_ADMIN exists** — you already ran `bun prisma/seed.ts` (`admin@geoplan.ph`). Change its
   password after first login.
3. Railway env: `ENFORCE_RLS=true`, `DATABASE_URL`=`app_user` role, `DIRECT_URL`=owner,
   `BETTER_AUTH_SECRET`, `APP_URL`, `CORS_ALLOWED_ORIGINS`.
   Run `prisma/rls-setup.sql` once. App must boot with no `[PrismaConnection] WARNING`.

---

## 1. Initialize both orgs via Postman

`{API}` = `https://assetwise-api.acethekawaii.work` (or `http://localhost:8000`).
**Turn on Postman's cookie jar** — Better Auth uses an httpOnly session cookie. Sign in first; the
cookie auto-attaches to the next calls.

### Step 1 — Sign in as SUPER_ADMIN
```
POST {API}/api/v1/auth/sign-in/email
Content-Type: application/json

{ "email": "admin@geoplan.ph", "password": "<your-changed-password>" }
```

### Step 2 — Create Geoplan (BASIC, inventory-only, subscribed)
Use a **distinct owner email** (not the platform admin email — it already exists).
```
POST {API}/api/v1/platform/organizations
Content-Type: application/json

{
  "name": "Geoplan",
  "plan": "BASIC",
  "printerType": "NONE",
  "trialDays": 0,
  "admin": {
    "name": "Geoplan Admin",
    "email": "owner@geoplan-internal.ph",
    "password": "<min 8 chars>"
  }
}
```
→ `{ organization, admin }`. That owner can now log in; they get Inventory only, no POS, no print button.

### Step 3 — Create Rapido (PRO, POS + Inventory, Niimbot, subscribed)
Both orgs are created fresh — no fixed ids. **Capture the returned `organization.id`** — you need it
to seed Rapido's products later.
```
POST {API}/api/v1/platform/organizations
Content-Type: application/json

{
  "name": "Rapido Motorsiklo Garage",
  "plan": "PRO",
  "printerType": "NIIMBOT",
  "trialDays": 0,
  "admin": {
    "name": "Rapido Owner",
    "email": "owner@rapido.ph",
    "password": "<min 8 chars>"
  }
}
```
> ⚠️ **Slug collision:** an old migration seeds an empty `rapido-motorsiklo-garage` org. If this POST
> returns 409, drop that stray row first (it has no data on a fresh DB), then retry:
> `DELETE FROM organizations WHERE slug='rapido-motorsiklo-garage';`
> (Or pass a different `"slug"` in the body.) Confirm with `SELECT id, slug, plan FROM organizations;`.

### Step 4 — (later) Public customer with a 7-day trial
```
POST {API}/api/v1/platform/organizations
{ "name":"Some Shop", "plan":"BASIC", "admin":{...} }   // trialDays omitted -> defaults to 7
```
When their 7 days elapse, they're auto-locked → trial-ended screen → your FB CTA. To activate them
after they pay you via message:
```
PATCH {API}/api/v1/platform/organizations/{orgId}
{ "trialDays": 0 }            // 0 clears the trial = subscribed. They must re-login to refresh.
```

---

## 1b. Seed Rapido's product catalog (later, when Rapido goes live)

Geoplan starts empty. Rapido's initial items come from `prisma/seed-motorshop-products.ts`. It now
reads the target org from **`RAPIDO_ORG_ID`** (the id you captured in Step 3) and writes under that
tenant's RLS context. Run against the live DB:
```bash
# bash
RAPIDO_ORG_ID=<rapido-org-id> DATABASE_URL=<live-db-url> bun prisma/seed-motorshop-products.ts
```
```powershell
# PowerShell
$env:RAPIDO_ORG_ID="<rapido-org-id>"; bun prisma/seed-motorshop-products.ts
```
Idempotent (upserts by `organizationId + sku`), so re-running is safe. Quantities start at 0.

---

## 2. Operator cheat-sheet (PATCH)

`PATCH /api/v1/platform/organizations/{orgId}` — send only what changes:
| Goal | Body |
|---|---|
| Upgrade to POS | `{ "plan": "PRO" }` |
| Downgrade | `{ "plan": "BASIC" }` |
| Set/refresh printer | `{ "printerType": "NIIMBOT" }` |
| Mark subscribed (clear trial) | `{ "trialDays": 0 }` |
| Start/extend a trial | `{ "trialDays": 7 }` |
| Force a specific trial end (testing) | `{ "trialEndsAt": "2020-01-01T00:00:00.000Z" }` (past ⇒ locked) |
| Suspend a tenant | `{ "isActive": false }` (locks them, same screen) |
| Reactivate | `{ "isActive": true }` |

Changes take effect on the user's **next login / entitlements refresh**. The platform SUPER_ADMIN
(org-less) always resolves to full PRO access and is never locked.

---

## 3. Smoke test
1. Boot: no RLS warning in logs.
2. `GET /api/v1/entitlements` as Geoplan owner → `plan:BASIC, features.pos:false`; UI shows no POS nav.
3. As Rapido owner → `plan:PRO, features.pos:true, printerType:NIIMBOT`; POS visible, Niimbot print button visible.
4. **Trial-expiry test:** `PATCH {orgId} { "trialEndsAt": "2020-01-01T00:00:00.000Z" }`, re-login as
   that org's owner → lock screen + Facebook CTA. Restore with `PATCH {orgId} { "trialDays": 0 }`.

---

## Known follow-ups (NOT blocking go-live)
- **Gating is frontend-only.** A BASIC user could still call POS APIs directly. Before public BASIC
  customers, add a backend `@RequireFeature('pos')` guard + a trial-lock guard on tenant routes.
- **Entitlements refresh only on login/app start.** After you PATCH a plan/trial, the user must
  re-login to see it. Add a manual refresh or short poll later if needed.
- **Per-instance frontend env.** If you ever split a client onto its own deployment, add an Angular
  build configuration with that API's `apiBaseUrl`.
