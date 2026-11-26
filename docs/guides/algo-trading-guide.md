# Algo Trading Guide — AI Trader (Groww + Upstox)

This guide explains how **AI Trader** executes the 9/21 EMA options strategy end-to-end and how to take a strategy from **Backtest → Paper Bot → Live Capital**.

---

## 1. Architecture Overview

1. **Market Data & Warmup**:
   - `MarketDataService` ([apps/engine/src/services/market-data.ts](../../apps/engine/src/services/market-data.ts)) connects `UpstoxMarketDataFeed` (via `UPSTOX_ANALYTICS_TOKEN`, no Static IP needed) and `BrokerRouter` (`ACTIVE_DATA_BROKER`, `ACTIVE_EXECUTION_BROKER`).
   - `TradingScheduler` ([apps/engine/src/services/scheduler.ts](../../apps/engine/src/services/scheduler.ts)) downloads & resamples 1m candles (`5m`, `15m`, `30m` aligned to `09:15 IST`).
2. **Signal Generation (`packages/strategy-core`)**:
   - `StreamingSignalGenerator` computes continuous `EMA(9)` and `EMA(21)` across day boundaries.
   - Detects crossovers inside your entry window (e.g., `09:30–11:30 IST`), selects the strike (`DEEP_ITM_BUY`, `ATM_BUY`, `ATM_SELL`), and enforces unconditional **`15:00 IST`** square-off.
3. **Risk & Execution (`apps/engine`)**:
   - **Paper Mode** (`PaperTradingEngine`): Simulates realistic fills with brokerage, STT, exchange fees, GST, stamp duty, and slippage.
   - **Live Mode** (`LiveTradingEngine`): Enforces 5 pre-trade risk checks + idempotency keys + partial-fill tracking + emergency kill switch.

---

## 2. Step-by-Step Workflow

### Phase 1 — Local Setup
1. Keep `ENABLE_LIVE_TRADING=false` in `.env`.
2. Configure `.env`:
   - `GROWW_TOTP_TOKEN` + `GROWW_TOTP_SECRET` (for Groww TOTP auth)
   - `UPSTOX_ANALYTICS_TOKEN` (1-year read-only token for Option Chain, Historical Candles & Live WS Ticks)
3. Start all apps: `bun run dev` (`API :3000`, `Engine :3001`, `Web :5173`).
4. Sign in at `http://localhost:5173/login` as `SUPER_ADMIN` (`admin@aitrader.in`).

### Phase 2 — Backtest & Audit
1. Create a strategy in **Strategy Builder** (`/strategy/builder`).
2. Run historical simulations in **Backtests** (`/backtest`).
3. Step through individual trades (`←` / `→`) in **Trade Auditor** (`/trade-auditor`) to verify EMA9/EMA21 crossovers.
4. Tune risk limits in **Settings** (`/settings` → **Risk & Execution Guardrails**).

### Phase 3 — Paper Trading Bot
1. Open **Bot Control Center** (`/bot`).
2. Verify **Engine: HEALTHY**, select your strategy, and click **Start Paper Bot**.
3. Monitor positions & ticks in **Paper Trading** (`/paper-trading`), OI/PCR in **Option Chain** (`/option-chain`), and events in **Audit Trail** (`/audit-logs`).

### Phase 4 — Live Trading (6 Mandatory Gates)
Open **Live Trading** (`/live-trading`). Live capital stays locked until all 6 gates pass:
1. `100+` completed paper trades
2. Paper Profit Factor `> 1.5`
3. Max Paper Drawdown `< 10%`
4. Admin Approval (`liveTradingApprovedAt` set in `user_profiles`)
5. Valid Broker Token (Groww TOTP synced, or Upstox OAuth + `X-Algo-Name`)
6. `ENABLE_LIVE_TRADING=true` on a dedicated Static-IP VPS (`apps/engine/Dockerfile`)
