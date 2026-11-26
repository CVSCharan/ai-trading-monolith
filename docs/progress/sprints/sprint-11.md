# Sprint 11 — Engine Dual-Broker Routing, Upstox WS & Option Chain UI

**Sprint Dates**: 2026-11-26 → 2026-12-02  
**Theme**: Runtime dual-broker routing (`Groww` + `Upstox`), Upstox Market Data WebSocket v3 feed, and Option Chain UI.

---

## Goal

Connect `GrowwClient` and `UpstoxClient` behind `BrokerAdapter` in `apps/engine`, stream real-time index/option ticks via Upstox's 1-year `UPSTOX_ANALYTICS_TOKEN`, and surface a dedicated Option Chain view in `apps/web`.

---

## Tickets

### S11-001 — `GrowwBrokerAdapter` & `BrokerRouter` (`apps/engine/src/services/broker-router.ts`) ✅
- Adapt `GrowwClient` to `BrokerAdapter` (`getHistoricalCandles`, `getQuote`, `placeOrder`, `cancelOrder`, `getPositions`, `getMargins`).
- Provide `createBrokerRouter()` reading `ACTIVE_DATA_BROKER` and `ACTIVE_EXECUTION_BROKER` from env.

### S11-002 — Upstox Market Data WebSocket v3 (`apps/engine/src/services/upstox-ws.ts`) ✅
- Authorize via `/v3/feed/market-data-feed/authorize` using `UPSTOX_ANALYTICS_TOKEN`.
- Subscribe to `NSE_INDEX|Nifty 50` and `NSE_INDEX|Nifty Bank` in `ltpc` / `full` mode with automatic reconnect.

### S11-003 — `OptionChainPage.tsx` (`apps/web/src/pages/OptionChainPage.tsx`) ✅
- Call/Put straddle-style Option Chain table (OI, IV, Delta, LTP) around spot/strikes.
- Summary metrics: Total Call OI, Total Put OI, Put-Call Ratio (PCR).
- Underlying selector (`NIFTY 50` / `NIFTY BANK`) + expiry date picker powered by `GET /api/upstox/option-chain`.

### S11-004 — Navigation & Header Broker Status (`apps/web/src/App.tsx`) ✅
- Add `/option-chain` route & sidebar link (`Option Chain`).
- Display active data/execution broker status in header (`DATA: ...` / `EXEC: ...`).
