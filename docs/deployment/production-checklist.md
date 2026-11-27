# Production Deployment & Pre-Live Checklist

## 1. Environment Variables

### `apps/web` (Vercel / Cloudflare Pages)
- `VITE_API_URL` — Public HTTPS URL of `apps/api`

### `apps/api` (Vercel / Docker)
- `DATABASE_URL` — Neon Postgres connection string (`sslmode=require`)
- `FRONTEND_URL` — Deployed `apps/web` URL (added to Better Auth `trustedOrigins` & CORS)
- `BETTER_AUTH_URL` — Deployed `apps/api` URL
- `BETTER_AUTH_SECRET` — 32+ char random secret
- `ENCRYPTION_MASTER_KEY` — 64 hex chars (32 bytes AES-256-GCM key for encrypting broker TOTP & operator 2FA secrets)
- `GROWW_TOTP_TOKEN` / `GROWW_TOTP_SECRET`
- `UPSTOX_ANALYTICS_TOKEN` (optional 1-year read-only market data & option chain)
- `ENABLE_LIVE_TRADING=false` (keep `false` until all Pre-Live gates pass)

### `apps/engine` (Dedicated VPS with Static IP)
- Same `DATABASE_URL`, `ENCRYPTION_MASTER_KEY`, `GROWW_*`, `UPSTOX_*`, `ACTIVE_DATA_BROKER`, `ACTIVE_EXECUTION_BROKER`
- `EMERGENCY_LIMIT_BUFFER_PCT=1` (Bounded price protection percentage for emergency limit order square-offs; default 1%)
- `GROWW_ALGO_NAME=AI_TRADER_921_EMA` (Algo identifier header required under NSE INSP77559)
- `UPSTOX_ALGO_NAME=AI_TRADER_921_EMA` (X-Algo-Name header for Upstox API v3 orders)
- **Static IP Registration**: Register VPS Public IP in broker developer consoles (Upstox & Groww) as mandated by NSE Circular INSP77559 for retail API-based automated order routing.

---

## 2. NSE Retail Algo Compliance (Circular INSP77559)

Under the NSE regulatory framework for API-based algorithmic trading by tech-savvy retail investors:
1. **Static IP Mandate**: Order placement APIs may only be called from an IP pre-registered with the broker. Automated trades originating from non-registered or dynamic IPs are prohibited.
2. **Algo Tagging (`X-Algo-Name`)**: All orders submitted to broker endpoints must attach an identified algorithm name (`X-Algo-Name` header and `tag: ai_trader_algo` payload).
3. **Price Protection on Execution**: Automated algorithms must NOT submit naked MARKET orders. All entries and square-offs must submit marketable `LIMIT` orders bounded by a 1%–2% price protection buffer and tick-size rounding.
4. **Operator 2FA & Kill Switch**: Live trading enablement strictly requires RFC 6238 TOTP step-up authentication. The engine maintains an emergency kill switch (`POST /api/live/emergency-stop`) that cancels pending orders and submits protected square-offs.
5. **Durable Audit Trail**: Every order (`live_fills`) and position (`live_positions`) is durably persisted in PostgreSQL with unique UUID idempotency keys for end-of-day broker audit reconciliation.

---

## 3. Database Management Scripts

- `bun run db:seed` — Seeds default instruments, strategy templates, cost configs, and admin operator profile (runs only on demand, never unconditionally on server startup).
- `bun run db:reset` — Drops/truncates tables with `CASCADE`, enforces production safeguards (`ALLOW_PROD_RESET=true`), and seeds clean state.

---

## 4. Smoke Test

Run against staging or production after deployment:

```bash
API_URL=https://api.example.com ENGINE_URL=https://engine.example.com bun run scripts/smoke-test.ts
```
