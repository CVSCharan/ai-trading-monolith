# Sprint 10 — Multi-Broker Integration (Groww + Upstox)

**Sprint Dates**: 2026-11-26 → 2026-11-30  
**Theme**: Dual-broker architecture supporting **Upstox Analytics Token** (1-year read-only market data, option chain, historical candles) and **Groww TOTP / Upstox v3** order execution.

---

## Goal

Decouple market data and order execution behind a unified `BrokerAdapter` interface so **AI Trader** can:
- Pull **1-year uninterrupted market data, option chains (OI/PCR), and historical candles** via `UPSTOX_ANALYTICS_TOKEN` in `.env` (no daily OAuth login, no Static IP needed for market data).
- Execute live orders via **Groww TOTP** (`GROWW_TOTP_TOKEN` / `GROWW_TOTP_SECRET`) or **Upstox API v3** (`/v3/order/place` with Static IP whitelisting + `X-Algo-Name` header).

---

## Tickets

### S10-001 — `.env` & Config Support for Upstox + Broker Routing ✅
- `apps/api/src/config.ts`: Add `UPSTOX_ANALYTICS_TOKEN`, `UPSTOX_ACCESS_TOKEN`, `UPSTOX_API_KEY`, `UPSTOX_API_SECRET`, `UPSTOX_REDIRECT_URI`, `UPSTOX_ALGO_NAME`, `ACTIVE_DATA_BROKER` (`groww | upstox`), `ACTIVE_EXECUTION_BROKER` (`groww | upstox`).
- `.env.example`: Document all Upstox variables cleanly without committing secrets.

### S10-002 — Unified `BrokerAdapter` Interface (`packages/shared`) ✅
- `packages/shared/src/broker.ts`: Define `BrokerName`, `BrokerCandle`, `BrokerQuote`, `OptionChainRow`, `BrokerOrderRequest`, `BrokerOrderResult`, `BrokerPosition`, `BrokerMarginInfo`, and `BrokerAdapter`.

### S10-003 — `UpstoxClient` (`apps/engine/src/services/upstox-client.ts`) ✅
- Uses `UPSTOX_ANALYTICS_TOKEN` for read-only market data (`/v2/market-quote/quotes`, `/v2/historical-candle/...`, `/v2/option/chain`) without requiring Static IP.
- Supports `checkStaticIp()` (`GET /user/ip`) and API v3 `placeOrder()` (`POST /v3/order/place` with `X-Algo-Name` header) when `UPSTOX_ACCESS_TOKEN` + Static IP are configured.

### S10-004 — `/api/upstox` Routes (`apps/api/src/routes/upstox.ts`) ✅
- `GET /api/upstox/status` — returns `.env` token presence (masked), `activeDataBroker`, `activeExecutionBroker`, and Static IP readiness.
- `GET /api/upstox/option-chain` — proxy option chain via `UPSTOX_ANALYTICS_TOKEN`.
- `GET /api/upstox/candles` — proxy historical candles via `UPSTOX_ANALYTICS_TOKEN`.
- `GET /api/upstox/ip` — check registered Static IPs (`SUPER_ADMIN` only).
- `GET /api/upstox/callback` — OAuth code-to-token exchange helper (`SUPER_ADMIN` only).

### S10-005 — Settings UI: Dual-Broker Panel (`apps/web/src/pages/SettingsPage.tsx`) ✅
- Show **Groww (TOTP)** and **Upstox (Analytics + v3 Trading)** cards side-by-side.
- Display masked `.env` tokens, active data/execution broker badges, and Static IP compliance notice for Upstox live orders.
