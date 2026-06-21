# Frontend integration guide — Passport/JWT → Better Auth

The backend auth changed from **Bearer JWT** to **Better Auth cookie sessions**. This is everything the frontend needs to change. API base: `https://assetwise-api.acethekawaii.work`, prefix `/api/v1`.

## 1. Send cookies on every request (the big one)
Auth is now an **httpOnly cookie** set by the API. There is no token to store or attach.

- `fetch`: add `credentials: 'include'` to **every** API call.
- `axios`: `axios.defaults.withCredentials = true` (or `withCredentials: true` per request).
- Angular `HttpClient`: set `withCredentials: true` on requests, or an interceptor that adds it.

Remove all old token logic: localStorage/sessionStorage token, the `Authorization: Bearer ...` header, and any token-refresh code. None of it applies anymore.

## 2. Endpoint changes
| Purpose | Old | New |
|---|---|---|
| Login | `POST /api/v1/auth/login` | `POST /api/v1/auth/sign-in/email` |
| Current user | `GET /api/v1/auth/me` | `GET /api/v1/auth/get-session` |
| Logout | (client-side token drop) | `POST /api/v1/auth/sign-out` |

### Login
`POST /api/v1/auth/sign-in/email` — body `{ "email", "password" }`, must send with credentials.
Response `200`: `{ "redirect": false, "token": "...", "user": {...} }` **and** a `Set-Cookie`. Ignore `token` — rely on the cookie. On bad credentials: `401 { "message": "Invalid email or password", "code": "INVALID_EMAIL_OR_PASSWORD" }`.

### Current session / user
`GET /api/v1/auth/get-session` (with credentials) →
```json
{
  "session": { "activeOrganizationId": "…", "userId": "…", "expiresAt": "…" },
  "user": { "id": "…", "name": "…", "email": "…", "role": "user", "image": null }
}
```
Returns `null` (200) when not logged in. Use this on app load to decide logged-in/out and to read the active org.

### Logout
`POST /api/v1/auth/sign-out` (with credentials) → clears the cookie.

## 3. User shape changed
- `firstName` / `lastName` are **gone** → use `user.name` (single field). Update any "First Last" rendering to just `user.name`.
- `user.role` is now a **system** role: `"admin"` = platform super-admin (one person), `"user"` = everyone else. The old `SUPER_ADMIN/ADMIN/USER` enum is gone.
- **Organization role** (owner/admin/member) is no longer on the user. If the UI needs it (e.g. show admin-only buttons), call `GET /api/v1/auth/organization/get-active-member` (with credentials) → `{ "role": "owner" | "admin" | "member", ... }`.
- The active organization is `session.activeOrganizationId` from `get-session` (auto-selected on login).

## 4. 401 handling
On any `401`, treat the user as logged out and route to the login page. There is no refresh-token dance — the session cookie lasts ~7 days; when it expires the user logs in again.

## 5. Admin/provisioning forms (only if your UI has them)
Bodies changed to use `name` (not first/last). All require being logged in as the platform admin (cookie), and send with credentials:
- Create tenant: `POST /api/v1/platform/organizations`
  `{ "name", "slug", "admin": { "email", "password", "name" } }`
- Add user to tenant: `POST /api/v1/platform/organizations/:orgId/users`
  `{ "email", "password", "name", "role": "ADMIN" | "USER" }`
- Add employee to your own org (org owner/admin): `POST /api/v1/users`
  `{ "email", "password", "name", "role": "ADMIN" | "USER" }`

There is **no public sign-up** — `POST /api/v1/auth/sign-up/email` is disabled by design.

## 6. CORS / cookies in production
- The API must be HTTPS and the cookie is `SameSite=None; Secure`, so the **frontend must also be HTTPS** (localhost is fine for dev).
- The backend env `CORS_ALLOWED_ORIGINS` must list the exact frontend origin (e.g. `https://app.example.com`) — `*` won't work with credentials.
- Business endpoints still return the wrapped shape `{ statusCode, message, data, meta }`; Better Auth `/auth/*` endpoints return raw JSON (e.g. `{ user, session }` or `{ message, code }`).

## Quick migration checklist
- [ ] Add `credentials:'include'` / `withCredentials:true` globally.
- [ ] Remove token storage + `Authorization` header + refresh logic.
- [ ] Login → `/auth/sign-in/email`; bootstrap user → `/auth/get-session`; logout → `/auth/sign-out`.
- [ ] Replace `firstName`/`lastName` with `name`.
- [ ] Replace role checks: system admin via `user.role==='admin'`; org role via `/auth/organization/get-active-member`.
- [ ] 401 → redirect to login.
- [ ] Update any provisioning forms to the `name` + `ADMIN/USER` bodies.
