# ⚡ Sprint 8 — Groww Pro Features (Custom Watchlist, Live Margin, OCO/GTT & Historical Backfill)

> **Start**: 2027-01-17 IST  
> **Target End**: 2027-01-21 IST (5 days)  
> **Status**: ⏳ QUEUED  
> **Gate from Sprint 7**: All 7 UI routes polished & visually verified in Chrome DevTools  
> **Gate to Scale**: Watchlist, pre-trade margin checks, broker-side OCO SL/Target, and historical backfill all verified

---

## Goal

Maximize Groww Trade API (`api.groww.in`, `X-API-VERSION: 1.0`) capabilities for an options trading desk:
- Note on **Groww UI Watchlist**: Groww Trade API does **not** expose an endpoint to read/sync the Groww mobile/web app's personal UI watchlist. Instead, we build a **DB-backed Custom Watchlist** powered by Groww's **Instruments Master + Live LTP/Quote + WebSocket feed**.
- Integrate **Margin API**, **Smart Orders (OCO / GTT)**, **Option Chain & Greeks**, **Historical Candles**, and **Positions/Holdings** into the engine, API, and UI.

---

## Tickets

### S8-001 — Custom Watchlist (DB + Groww Instruments & Live LTP/WS) {#S8-001}
| **ETA** | 2027-01-17 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Add `watchlists` table + `/api/watchlist` CRUD routes + Dashboard/Sidebar Watchlist drawer. Search any NSE/NFO symbol from Groww Instruments Master, pin NIFTY/BANKNIFTY spots & active strikes, stream live LTP/% change over WebSocket, and 1-click jump to Backtest or Trade Auditor.

### S8-002 — Live Margin & Funds Check (`/v1/margins/detail/user`) {#S8-002}
| **ETA** | 2027-01-18 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Add `getMarginDetails()` to `GrowwClient`, expose `GET /api/groww/margins`, display available margin/collateral in `PortfolioBar`, and enforce pre-order available-margin check in `LiveTradingEngine.validateRiskChecks()` to prevent margin shortfall rejections.

### S8-003 — Broker-Side Smart Orders: OCO & GTT (`/v1/order-advance/create`) {#S8-003}
| **ETA** | 2027-01-19 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Add `createSmartOrder()` (`OCO` target + stop-loss bracket, `GTT`) to `GrowwClient` so live options positions can attach broker-hosted SL/Target protection (survives engine/network disconnects alongside `15:00 IST` square-off).

### S8-004 — Historical Candle Backfill (`/v1/historical/candle/range`) {#S8-004}
| **ETA** | 2027-01-20 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Add `getHistoricalCandles()` to `GrowwClient` and `/api/market/backfill` so Backtests, EMA9/EMA21 startup warmup, and Trade Auditor ±30m charts can pull fresh NSE/NFO historical candles directly from Groww.

### S8-005 — Live Positions & Holdings Sync (`/v1/positions/user`) {#S8-005}
| **ETA** | 2027-01-21 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Connect `ReconciliationService` and `PortfolioBar` to Groww's live `positions` & `holdings` endpoints so real broker P&L, collateral, and open F&O lots reconcile automatically on startup and every 60s.

---

*Sprint 8 · Target: 2027-01-21 · 5 tickets*
