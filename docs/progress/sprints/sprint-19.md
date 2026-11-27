# Sprint 19 — Live Trading Safety Hardening & UI Skeletons

**Sprint Dates**: 2026-11-26 → 2026-12-16  
**Theme**: Phase 1 & Phase 2 Live Trading Safety Hardening (Emergency Stop, Bounded Limit Square-Offs, Exit-Time Drawdown Gates, Operator 2FA, Durable PostgreSQL State, Startup Hydration, and NSE Algo Order Tagging) and Glassmorphic Skeleton Loading Architecture. Live trading remains strictly disabled (`ENABLE_LIVE_TRADING=false`) pending remaining production quote sourcing and order update stream integration.

---

## Tickets

### S19-001 — Emergency-Stop Async Acknowledgment & Disarm-First Engine Flow ✅
- **API (`apps/api/src/routes/live-trading.ts`)**:
  - `POST /api/live/emergency-stop` enqueues `{ cancelOrders: true, closePositions: true, reason }`.
  - Responds with HTTP `202 Accepted` and `{ requested: true, commandId }` instead of `{ stopped: true }`, reflecting asynchronous execution by the engine poller.
- **Engine (`apps/engine/src/services/command-processor.ts`)**:
  - Disarms in-memory sessions first to stop new order generation.
  - Automatically attempts order cancellations and position square-offs by default.
  - Keeps live positions marked as open in the database until broker fill updates / reconciliation confirm execution.
  - Collects and logs individual position failure reasons.

### S19-002 — Bounded Limit Order Emergency Closes (`EMERGENCY_LIMIT_BUFFER_PCT`) ✅
- **Engine (`apps/engine/src/services/command-processor.ts`)**:
  - Emergency square-offs submit tick-rounded, bounded `LIMIT` orders rather than unconstrained `MARKET` orders.
  - Price buffer configured via `EMERGENCY_LIMIT_BUFFER_PCT` (default `1%`, greater than `0%` and at most `5%`).
  - Rounds prices to valid exchange instrument `tickSize` (`Math.ceil` for BUY to close shorts, `Math.floor` for SELL to close longs).
  - Explicit invariant: A submitted order is treated as pending, not as a filled position.

### S19-003 — Exit-Time Drawdown Gate & Incomplete Trade Filtering ✅
- **API (`apps/api/src/routes/live-trading.ts`)**:
  - Filters `paperTrades` to require completed trades only (`isNotNull(exitTime)` and `isNotNull(netPnl)`).
  - Sorts trades chronologically by `asc(paperTrades.exitTime)`.
  - Computes peak-to-trough drawdown across the closed equity curve from the portfolio's actual `dayStartValue`.
  - Evaluates drawdown (< 10.00%), trade-count (>= 100), and profit-factor (> 1.5) gates server-side.

### S19-004 — Full Glassmorphic Skeleton Loading Architecture ✅
- **UI (`apps/web/src/components/ui/skeleton.tsx` & Pages)**:
  - Added `<Skeleton />`, `<SkeletonMetricCard />`, `<SkeletonTable />`, `<SkeletonChart />`, `<SkeletonMarketGrid />`, and `<InitialLoader />`.
  - Implemented responsive skeleton loaders and laser-shimmer startup state across Dashboard, Option Chain, Bot Control, Paper Trading, Trade Auditor, Audit Logs, Settings, and AuthGuard.

### S19-005 — Operator Authenticator 2FA Enrollment & Dynamic Step-Up Verification ✅
- **Database (`apps/api/src/db/schema.ts`)**:
  - Added `twoFactorSecretEncrypted` and `twoFactorEnabledAt` to `user_profiles`.
- **API (`apps/api/src/routes/auth-extra.ts` & `apps/api/src/routes/live-trading.ts`)**:
  - Implemented `GET /api/auth/2fa/status`, `POST /api/auth/2fa/setup` (Base32 secret + `otpauth://` URI), `POST /api/auth/2fa/verify`, and `POST /api/auth/2fa/disable`.
  - Stored secrets encrypted via master AES-256-GCM encryption key.
  - `POST /api/live/enable` enforces genuine 6-digit TOTP code verification against operator profile before authorizing command enqueue.
- **UI (`apps/web/src/pages/SettingsPage.tsx` & `LiveTradingPage.tsx`)**:
  - Added Operator 2FA setup/verify/disable card in Settings.
  - Added dynamic 6-digit TOTP step-up modal in Live Trading before activation.

### S19-006 — Real Strategy Signal Classification & Order Mapping ✅
- **Engine (`apps/engine/src/services/live-trading.ts`)**:
  - Replaced the flawed `startsWith('ENTRY')` classification with `metadata.isExit` and require supported execution-mode metadata (`DEEP_ITM_BUY`, `ATM_BUY`, `ATM_SELL`).
  - Long and short entries use execution mode; exits use the opposite side of the tracked position and its remaining filled quantity. Reversal signals fail closed pending explicit close-then-open handling.
  - Pre-trade risk checks run before submission.

### S19-009 — Durable PostgreSQL Live Fills & Positions State ✅
- **Engine (`apps/engine/src/services/live-trading.ts`)**:
  - Converted volatile in-memory maps into durably synchronized records in `live_fills` and `live_positions`.
  - Deterministic UUID idempotency keys generated via `stringToUuid` to protect against duplicate submissions.
  - Added `hydratePositionsFromDb(userId)`: restores open positions, active fills, and today's realized P&L from PostgreSQL on engine boot and live enable.
  - Partial and complete fills from WebSocket order updates update `live_fills` and `live_positions` status, quantities, average prices, and realized P&L.

### S19-010 — Startup Reconciliation Sequence & State Hydration ✅
- **Engine (`apps/engine/src/index.ts` & `command-processor.ts`)**:
  - Wired `commandProcessor.setLiveEngine(liveEngine)`.
  - Multi-broker position reconciliation and `liveEngine.hydratePositionsFromDb(userId)` execute **strictly before** opening market data feeds, registering schedulers, and starting command pollers.
  - `/ready` endpoint reports HTTP 503 until startup reconciliation and hydration succeed.

### S19-012 — Regulatory & Algo Undertaking Compliance (NSE Circular INSP77559) ✅
- **Engine & Shared (`GrowwClient`, `UpstoxClient`, Documentation)**:
  - Attached `X-Algo-Name` header (`AI_TRADER_921_EMA`) and payload `tag: 'ai_trader_algo'` on all order placement calls to Groww and Upstox.
  - Documented Static IP registration requirements for VPS deployment under NSE Circular INSP77559.
  - Prohibited naked market orders; mandated bounded marketable limit orders with tick-rounded price protection.

---

## 🔒 Remaining Live Trading Hardening Items (To Complete Before Live Execution)

> [!CAUTION]
> **LIVE CAPITAL LOCK (`ENABLE_LIVE_TRADING=false`)**  
> Live capital execution remains disabled until the final integration items below are resolved:

### S19-007 — Real-Time Option Premium Sourcing in Bar-Close Loop 🟡 Pending
- **Location**: `apps/engine/src/index.ts` (lines 185–199) & `apps/engine/src/services/live-trading.ts`.
- **Issue**: `liveEngine.onBarClose` accepts an `optionPriceLookup?: (signal: Signal) => Promise<number | undefined>` parameter. In `apps/engine/src/index.ts`, `onBarClose` is currently called without passing an `optionPriceLookup`. Because the engine refuses to place orders without a valid option premium, all live signals are rejected with:
  `Live signal rejected: no valid option premium is available`.
- **Resolution Needed**: Pass a real quote resolver in `apps/engine/src/index.ts` that fetches live option LTP via `marketData` / `UpstoxClient.getQuote` / `GrowwClient.getQuote`.

### S19-008 — Broker WebSocket Order Fill Stream Ingestion 🟡 Pending
- **Location**: `apps/engine/src/services/groww-client.ts`, `upstox-client.ts`, & `index.ts`.
- **Issue**: `liveEngine.handleOrderUpdate(update)` accurately updates `live_fills` and `live_positions`. However, in production, neither Groww nor Upstox order WebSockets are currently subscribed to and piped into `liveEngine.handleOrderUpdate`.
- **Resolution Needed**: Connect broker order-update feeds (Groww WebSocket / Upstox Order Updates V2) to dispatch fill events into `liveEngine.handleOrderUpdate`.

### S19-011 — End-to-End Multi-Broker Simulation Tests 🟡 Pending
- **Location**: `apps/engine/test/live-integration.test.ts`.
- **Issue**: Current tests in `live-engine.test.ts` test isolated unit methods. Add full simulated bar → signal → option quote lookup → order submission → fill update → square-off cycle integration tests.

### S19-013 — Explicit Reversal Signal Lifecycle (Close-then-Open) 🟡 Pending
- **Location**: `apps/engine/src/services/live-trading.ts` (lines 249–251).
- **Issue**: Reversal signals currently fail-close (`reversal signals require explicit close-then-open handling`). Implement sequential close of the active leg followed by entry in the reverse direction.
