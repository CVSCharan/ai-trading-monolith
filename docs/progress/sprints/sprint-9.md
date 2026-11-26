# Sprint 9 — Auth, RBAC & Demo Account

**Sprint Dates**: 2026-11-26 → 2026-11-28  
**Theme**: Industry-standard authentication, two-role RBAC (SUPER_ADMIN / DEMO), demo showcase account, forgot/reset password, and session-aware UI.

---

## Goal

Implement a production-grade authentication layer for AI Trader with:
- **SUPER_ADMIN**: The operator. Full Groww connection, live trading gates, emergency stop, strategy CRUD, audit logs.
- **DEMO**: Read-only showcase account. Pre-seeded paper trades and equity curve. Visually highlighted "DEMO MODE" banner. No password reset. No live trading. Perfect for portfolio/resume demonstration.

---

## Tickets

### S9-001 — Add `role` column to `userProfiles` schema  ✅
- File: `apps/api/src/db/schema.ts`
- Add `pgEnum('user_role', ['SUPER_ADMIN', 'DEMO'])` and `role` column to `userProfiles`
- Also add `role` as `additionalField` in Better Auth config (`apps/api/src/auth.ts`)

### S9-002 — DB migration SQL for role column  ✅
- File: `apps/api/src/db/migrations/0001_add_user_role.sql`
- `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'SUPER_ADMIN';`

### S9-003 — Seed script: SUPER_ADMIN + DEMO user  ✅
- File: `apps/api/src/db/seed.ts`
- Upsert SUPER_ADMIN from `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` env
- Upsert DEMO: `demo@aitrader.in` / `Demo@2025`, role `DEMO`, ~20 pre-seeded paper trades

### S9-004 — Auth API routes: session, forgot-password, reset-password  ✅
- File: `apps/api/src/routes/auth-extra.ts`
- `GET /api/auth/session` → returns `{ user: { id, email, name, role }, expiresAt }`
- `POST /api/auth/forgot-password` → signed 1hr JWT reset link (email via SMTP/Resend). Blocked for DEMO role.
- `POST /api/auth/reset-password` → validate token, bcrypt hash, update password. Blocked for DEMO.

### S9-005 — RBAC middleware `requireRole`  ✅
- File: `apps/api/src/middleware/auth-middleware.ts` (extend existing)
- `requireRole(role: 'SUPER_ADMIN')` → 403 if user role doesn't match
- Wire onto: `POST /api/live/enable`, `POST /api/live/disable`, `POST /api/live/emergency-stop`, `POST /api/groww/connect`, `POST /api/groww/sync`, engine commands

### S9-006 — `AuthContext` + `useAuth` hook  ✅
- File: `apps/web/src/context/AuthContext.tsx`
- Fetches `GET /api/auth/session` on mount; exposes `{ user, role, isLoading, isDemo, isSuperAdmin, logout }`
- Provides `<AuthProvider>` wrapping entire app

### S9-007 — `AuthGuard` + `RoleGuard` components  ✅
- File: `apps/web/src/components/AuthGuard.tsx`
- `<AuthGuard>` → redirects to `/login` if no session
- `<RoleGuard role="SUPER_ADMIN">` → shows locked overlay for DEMO users on protected pages

### S9-008 — `LoginPage.tsx`  ✅
- File: `apps/web/src/pages/LoginPage.tsx`
- AI Trader brand, email+password form, "Forgot password?" link
- Demo login shortcut button (pre-fills `demo@aitrader.in` / `Demo@2025`)
- Calls Better Auth `POST /api/auth/sign-in/email`

### S9-009 — `ForgotPasswordPage.tsx` + `ResetPasswordPage.tsx`  ✅
- Files: `apps/web/src/pages/ForgotPasswordPage.tsx`, `apps/web/src/pages/ResetPasswordPage.tsx`
- Email input → POST `/api/auth/forgot-password`
- Reset token from URL param → POST `/api/auth/reset-password`

### S9-010 — DEMO MODE UI: banner + locked overlays  ✅
- Update `App.tsx`: show amber `DEMO MODE` badge in header when `isDemo`
- Sidebar: lock Live Trading nav item for DEMO
- `SettingsPage.tsx`: grey out Groww connect section for DEMO with tooltip
- `LiveTradingPage.tsx`: full-page DEMO lock overlay

### S9-011 — Wire routes + update `board.md` + daily log  ✅
- Public routes: `/login`, `/forgot-password`, `/reset-password`
- Protected routes: everything else via `<AuthGuard>`
- Push `docs/progress/sprints/sprint-9.md`, `docs/progress/board.md`, `docs/progress/daily/2026-11-26.md`

---

## Acceptance Criteria

- [ ] `tsc --noEmit` passes across all 5 packages
- [ ] `vite build apps/web` succeeds (no TS errors)
- [ ] 57 tests still pass (no regression)
- [ ] `/login` renders with AI Trader brand
- [ ] Demo login shortcut logs in and shows `DEMO MODE` badge
- [ ] SUPER_ADMIN login unlocks all features
- [ ] Forgot password blocks for DEMO role (returns 403)
- [ ] `/api/auth/session` returns role in payload
- [ ] `POST /api/live/enable` returns 403 without SUPER_ADMIN role

---

## Notes

- Better Auth `emailAndPassword` already enabled — sign-in/sign-out endpoints available at `/api/auth/sign-in/email` and `/api/auth/sign-out`
- Password hashing: Better Auth handles bcrypt internally
- Demo password reset intentionally blocked server-side AND client-side
- Reset password email: uses `SMTP_HOST/PORT/USER/PASS` or `RESEND_API_KEY` env vars
