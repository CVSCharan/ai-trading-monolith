# Production Deployment & Pre-Live Checklist

## 1. Environment Variables

### `apps/web` (Vercel)
- `VITE_API_URL` — Public HTTPS URL of `apps/api`

### `apps/api` (Vercel / Docker)
- `DATABASE_URL` — Neon Postgres connection string (`sslmode=require`)
- `FRONTEND_URL` — Deployed `apps/web` URL (added to Better Auth `trustedOrigins` & CORS)
- `BETTER_AUTH_URL` — Deployed `apps/api` URL
- `BETTER_AUTH_SECRET` — 32+ char random secret
- `ENCRYPTION_MASTER_KEY` — 64 hex chars (32 bytes)
- `GROWW_TOTP_TOKEN` / `GROWW_TOTP_SECRET`
- `UPSTOX_ANALYTICS_TOKEN` (optional 1-year read-only market data & option chain)
- `ENABLE_LIVE_TRADING=false` (keep `false` until all Pre-Live gates pass)

### `apps/engine` (Dedicated VPS with Static IP)
- Same `DATABASE_URL`, `ENCRYPTION_MASTER_KEY`, `GROWW_*`, `UPSTOX_*`, `ACTIVE_DATA_BROKER`, `ACTIVE_EXECUTION_BROKER`
- If `ACTIVE_EXECUTION_BROKER=upstox`, register VPS Static IP in Upstox Developer Console and set `UPSTOX_ALGO_NAME`.

---

## 2. Smoke Test

Run against staging or production after deployment:

```bash
API_URL=https://api.example.com ENGINE_URL=https://engine.example.com bun run scripts/smoke-test.ts
```
