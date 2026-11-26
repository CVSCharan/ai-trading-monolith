# Sprint 14 — Production Session Security, Max 3 Devices & Profile Page

**Sprint Dates**: 2026-11-26 → 2026-12-10  
**Theme**: Production-grade rolling `httpOnly` session management, max 3 concurrent devices (FIFO eviction), device revocation, password change, pre-market broker token refresh, and Profile UI.

---

## Tickets

### S14-001 — Rolling Session & Max 3 Concurrent Sessions (`apps/api/src/auth.ts`) ✅
- Configure `expiresIn: 7 days`, `updateAge: 1 hour` rolling rotation, and explicit `httpOnly / sameSite: 'lax' / secure` cookie attributes.
- Add `databaseHooks.session.create.after` enforcing `MAX_ACTIVE_SESSIONS = 3` per `userId` (auto-evicts oldest sessions).

### S14-002 — Session Revocation, Logout All & Change Password API (`auth-extra.ts` + `user.ts`) ✅
- `GET /api/auth/sessions` — list active sessions with `isCurrent` flag
- `DELETE /api/auth/sessions/:id` — revoke specific device session
- `POST /api/auth/logout-all` — revoke all sessions for user + audit log
- `POST /api/auth/change-password` — verify current password via `better-auth/crypto` (blocked for `DEMO`)
- `PATCH /api/user/profile` — update `displayName` & `timezone` (blocked for `DEMO`)

### S14-003 — `08:45 IST` Pre-Market Groww Token Refresh (`apps/engine/src/services/scheduler.ts`) ✅
- Scheduled weekday cron (`45 8 * * 1-5`, `Asia/Kolkata`) refreshing Groww TOTP access token before `09:15 IST` market open.

### S14-004 — Profile & Active Devices Page (`ProfilePage.tsx` + `/profile`) ✅
- Display & edit user profile, inspect active devices (max 3), revoke single device or **Log out of all devices**, and change password (`SUPER_ADMIN` only).
