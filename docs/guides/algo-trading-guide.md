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

### Phase 4 — Live Trading Safeguards & Kill-Switch Architecture

> [!CAUTION]
> **LIVE TRADING STATUS: STRICTLY DISABLED (`ENABLE_LIVE_TRADING=false`)**
> Live capital execution is unsafe and disabled. The code has some fail-closed and state-safety hardening, but critical production blockers remain:
> - **2FA Blocker**: `/api/live/enable` now fails closed and the engine rejects queued enable commands. A real operator TOTP enrollment and step-up verification flow is still required.
> - **Signal Mapping**: Real `BUY`/`SELL` signal classification and execution-mode mapping are partly hardened; reversal handling and durable position/order lifecycle remain incomplete.
> - **Option Pricing**: The engine rejects signals without a valid option quote, but production bar processing currently provides no `optionPriceLookup`; live signals therefore cannot execute. A correct broker instrument mapping and fresh quote source are required.
> - **Fill Confirmation**: Square-off state waits for a mocked/injected fill update in unit-tested code, but no production broker order-update stream calls the handler and the state remains in memory.
> - **Durable State & Startup**: Startup reconciliation now runs before market feeds, scheduler, and command polling; `/ready` remains unavailable until startup succeeds. Live order/position persistence, hydration, and complete reconciliation behavior remain incomplete.
> - **Integration Evidence**: Current engine tests are unit tests. Broker event delivery, quote mapping, restart recovery, and exchange integration have not been proven end to end.
> - **Regulatory Compliance**: Algo order tagging and static IP undertakings under NSE circular INSP77559 must be verified.

#### 1. Live Safety Gates (Read-Only Until Operator 2FA Exists)
The gates endpoint reports these checks. Live enable remains blocked until operator 2FA is implemented and verified:
1. **100+ Completed Paper Trades**: Open or incomplete trades are strictly excluded (`isNotNull(exitTime)` and `isNotNull(netPnl)`).
2. **Paper Profit Factor > 1.5**: Gross wins divided by gross losses across completed trades.
3. **Max Drawdown < 10.00%**: Evaluated in chronological `exitTime` order across the closed equity curve from peak-to-trough.
4. **Admin Approval**: `liveTradingApprovedAt` set in `user_profiles`.
5. **Valid Broker Token**: Active Groww TOTP or Upstox trading session.
6. **Environment Flag**: `ENABLE_LIVE_TRADING=true` on dedicated Static-IP host.
7. **Operator 2FA**: Genuine user step-up verification; this is currently unavailable and therefore fails closed.

#### 2. Emergency Kill-Switch & Execution Invariants
- **Async Acknowledgment**: `POST /api/live/emergency-stop` queues an engine command and returns HTTP `202 Accepted` (`{ requested: true }`). It does not declare positions closed until broker execution is confirmed.
- **Disarm First**: The engine disarms active strategy generators immediately to stop any new order placements before attempting broker cleanup.
- **Cancellation & Close by Default**: Open orders are cancelled and live positions are squared off automatically by default (`cancelOrders: true, closePositions: true`).
- **Bounded Limit Orders (`EMERGENCY_LIMIT_BUFFER_PCT`)**: Square-offs use tick-rounded marketable `LIMIT` orders with a bounded price buffer (default 1%, greater than 0% and at most 5%). This order type alone does not establish full exchange compliance; algo tagging, broker requirements, and current exchange controls still require review.
- **Fill-Confirmed Accounting**: Local position state remains `CLOSING` after square-off submission. Production accounting is not fill-confirmed yet: order updates are not wired into this handler and live engine state is not persisted in Postgres.

