# Algo Trading Guide — AI Trader (Multi-Broker Options & Algo Terminal)

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
   - **Live Mode** (`LiveTradingEngine`): Enforces 5 pre-trade risk checks + durable PostgreSQL `live_fills` / `live_positions` + idempotency keys + partial-fill tracking + emergency kill switch.

---

## 2. Step-by-Step Workflow

### Phase 1 — Local Setup
1. Keep `ENABLE_LIVE_TRADING=false` in `.env`.
2. Configure `.env`:
   - `GROWW_TOTP_TOKEN` + `GROWW_TOTP_SECRET` (for Groww TOTP auth)
   - `UPSTOX_ANALYTICS_TOKEN` (1-year read-only token for Option Chain, Historical Candles & Live WS Ticks)
3. Start all apps: `bun run dev` (`API :8000`, `Engine :8001`, `Web :5173`).
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
> **LIVE CAPITAL LOCK (`ENABLE_LIVE_TRADING=false`)**
> Real money trading remains disabled by default until your deployment passes all 6 gates, operator 2FA verification, and end-of-day broker audit reconciliation.

#### 1. Live Safety Gates & Operator 2FA (S19-005)
Live enablement (`POST /api/live/enable`) requires a real 6-digit dynamic TOTP code from an authenticator app (Google Authenticator, Authy, 1Password) and evaluates:
1. **100+ Completed Paper Trades**: Open or incomplete trades are strictly excluded (`isNotNull(exitTime)` and `isNotNull(netPnl)`).
2. **Paper Profit Factor > 1.5**: Gross wins divided by gross losses across completed trades.
3. **Max Drawdown < 10.00%**: Evaluated in chronological `exitTime` order across the closed equity curve from peak-to-trough.
4. **Admin Approval**: `liveTradingApprovedAt` set in `user_profiles`.
5. **Valid Broker Token**: Active Groww TOTP or Upstox trading session.
6. **Operator 2FA Step-Up**: Evaluated dynamically using AES-256-GCM encrypted operator secrets in PostgreSQL.
7. **Environment Flag**: `ENABLE_LIVE_TRADING=true` on dedicated Static-IP host.

#### 2. Durable Persistence & Startup Hydration (S19-009, S19-010)
- **Durable Audit Trail**: Every live order is stored in `live_fills` with a deterministic UUID idempotency key, and every active position is persisted in `live_positions`.
- **Crash Recovery & Reconciliation**: Startup reconciliation runs *before* opening market data WebSockets, starting schedulers, or polling commands.
- **Position Hydration**: `liveEngine.hydratePositionsFromDb(userId)` restores open positions and today's realized PnL on boot and strategy enablement.

#### 3. NSE Circular INSP77559 Compliance (S19-012)
- **Algo Tagging**: Orders sent to Groww and Upstox include `X-Algo-Name` header and `tag: 'ai_trader_algo'`.
- **Price Protection**: All automated retail algo orders use tick-rounded marketable `LIMIT` orders with 1% price protection buffer. Naked market orders are prohibited.
- **Static IP Undertaking**: Dedicated VPS host IP must be pre-registered with broker developer consoles.

#### 4. Emergency Kill-Switch Architecture
- **Async Acknowledgment**: `POST /api/live/emergency-stop` queues an engine command and returns HTTP `202 Accepted` (`{ requested: true }`).
- **Disarm First**: The engine disarms active strategy generators immediately to stop any new order placements before attempting broker cleanup.
- **Cancellation & Close by Default**: Open orders are cancelled and live positions are squared off automatically by default (`cancelOrders: true, closePositions: true`).
