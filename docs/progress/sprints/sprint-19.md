# Sprint 19 — Live Trading Safety Hardening & UI Skeletons

**Sprint Dates**: 2026-11-26 → 2026-12-16  
**Theme**: Phase 1 Live Trading Safety Hardening (Emergency Stop, Bounded Limit Square-Offs, Exit-Time Drawdown Gates) and Glassmorphic Skeleton Loading Architecture. Live trading remains strictly disabled (`ENABLE_LIVE_TRADING=false`) pending Phase 2 safety controls.

---

## Tickets

### S19-001 — Emergency-Stop Async Acknowledgment & Disarm-First Engine Flow ✅
- **API (`apps/api/src/routes/live-trading.ts`)**:
  - `POST /api/live/emergency-stop` now enqueues `{ cancelOrders: true, closePositions: true, reason }`.
  - Responds with HTTP `202 Accepted` and `{ requested: true, commandId }` instead of `{ stopped: true }`, reflecting asynchronous execution by the engine poller.
- **Engine (`apps/engine/src/services/command-processor.ts`)**:
  - Disarms in-memory sessions first to stop new order generation.
  - Automatically attempts order cancellations and position square-offs by default.
  - Keeps live positions marked as open in the database until broker fill updates / reconciliation confirm execution.
  - Collects and logs individual position failure reasons.

### S19-002 — Bounded Limit Order Emergency Closes (`EMERGENCY_LIMIT_BUFFER_PCT`) ✅
- **Engine (`apps/engine/src/services/command-processor.ts`)**:
  - Emergency square-offs submit tick-rounded, bounded `LIMIT` orders rather than unconstrained `MARKET` orders. This alone does not establish full exchange compliance; algo tagging, broker requirements, and current exchange controls remain open under S19-012.
  - Price buffer configured via `EMERGENCY_LIMIT_BUFFER_PCT` (default `1%`, greater than `0%` and at most `5%`).
  - Rounds prices to valid exchange instrument `tickSize` (`Math.ceil` for BUY to close shorts, `Math.floor` for SELL to close longs).
  - Explicit invariant: A submitted order is treated as pending, not as a filled position.

### S19-003 — Exit-Time Drawdown Gate & Incomplete Trade Filtering ✅
- **API (`apps/api/src/routes/live-trading.ts`)**:
  - Filters `paperTrades` to require completed trades only (`isNotNull(exitTime)` and `isNotNull(netPnl)`).
  - Sorts trades chronologically by `asc(paperTrades.exitTime)`.
  - Computes peak-to-trough drawdown across the closed equity curve from the portfolio's actual `dayStartValue`.
  - Reports drawdown, trade-count, and profit-factor gates as read-only. Live enable currently fails closed before these checks can authorize execution; they must be re-enforced in the enable transaction after operator 2FA exists.

### S19-004 — Full Glassmorphic Skeleton Loading Architecture ✅
- **UI (`apps/web/src/components/ui/skeleton.tsx` & Pages)**:
  - Added `<Skeleton />`, `<SkeletonMetricCard />`, `<SkeletonTable />`, `<SkeletonChart />`, and `<SkeletonMarketGrid />`.
  - Implemented responsive skeleton loaders across Dashboard, Option Chain, Bot Control, Paper Trading, Trade Auditor, Audit Logs, Market Session Clocks, and AuthGuard.

---

## 🔒 Phase 2 Blockers & Invariants (Live Trading Unsafe)

> [!CAUTION]
> **VERDICT: LIVE TRADING REMAINS UNCONDITIONALLY DISABLED (`ENABLE_LIVE_TRADING=false`)**  
> While initial Phase 1 wiring and safety gates were added, code audits confirm critical live-trading defects. Real capital execution is unsafe and blocked until all of the following architectural prerequisites are corrected:

1. **S19-005 (Blocker — 2FA Verification Bypass)**:
   - *Defect found*: API previously hardcoded `twoFactorVerified: true` into `enable_live`, bypassing user verification.
   - *Fail-closed mitigation implemented*: `/api/live/enable` now returns 503 and records a blocked attempt; the engine rejects stale `enable_live` commands and the gates endpoint reports operator 2FA as failed. A queued boolean is not accepted as proof.
   - *Still required*: Implement operator TOTP enrollment and secret storage, accept a user-submitted 6-digit step-up code on `/api/live/enable`, and verify it server-side. Keep live enable blocked until then.

2. **S19-006 (Blocker — Strategy Signal Misclassification)**:
   - *Defect*: `LiveTradingEngine.placeOrder` classifies entries using `String(signal.signalType).startsWith('ENTRY')` (`apps/engine/src/services/live-trading.ts:120`). Real strategy signals use `BUY`/`SELL` with exits indicated by `metadata.isExit`. This defect bypasses entry risk limits and sends `SELL` for every real signal.
   - *Fix Required*: Align with `paper-trading.ts`: check `Boolean(signal.metadata?.isExit)`, properly route entries vs exits, and set order side correctly (`BUY` for long calls/puts, `SELL` for exits).

3. **S19-007 (Blocker — Limit Price Sourced from Underlying Spot Index)**:
   - *Defect*: `onBarClose` passes `sig.spotPrice` (e.g. NIFTY index at 24,530) into `placeOrder` as `optionPrice` (`apps/engine/src/services/live-trading.ts:286`). Resulting limit order is placed at 24,775 instead of option premium (~₹150).
   - *Fix Required*: Provide an `optionPriceLookup` callback wired to live market data quotes / option chain cache to get the actual option LTP before placing orders.

4. **S19-008 (Blocker — Premature Square-Off Position Closure)**:
   - *Defect*: `squareOffAll` marks positions as `CLOSED` immediately upon order submission (`apps/engine/src/services/live-trading.ts:238`) without waiting for broker fill confirmation, and fails to persist close order IDs for fill tracking.
   - *Fix Required*: Mark positions as `CLOSING`, record close order IDs, and only transition to `CLOSED` when WebSocket order fill updates (`handleOrderUpdate`) confirm execution.

5. **S19-009 (Blocker — In-Memory Volatile State & Missing DB Persistence)**:
   - *Defect*: Positions and idempotency stores exist purely in RAM (`new Map()`). A process restart wipes all tracking.
   - *Fix Required*: Create durable `live_orders` and `live_positions` tables in PostgreSQL with transaction-safe state transitions and hydration on startup.

6. **S19-010 (Blocker — Startup Reconciliation Sequence Ordering)**:
   - *Defect*: `reconciliation.reconcileOnStart` executes at line 200 of `apps/engine/src/index.ts`, *after* `marketData.connect()`, `scheduler.start()`, and `setInterval(pollCommands)` have already begun ingesting ticks and polling commands.
   - *Fix Required*: Block feed connection and scheduler startup until startup reconciliation has fully matched broker positions with database state.

7. **S19-011 (Blocker — Flawed Test Fixtures)**:
   - *Defect*: Unit test in `apps/engine/test/live-engine.test.ts` uses synthetic `'ENTRY_LONG'` and `'LIVE'`, testing direct `placeOrder` rather than the real strategy-to-order pipeline and masking the signal classification bug.
   - *Fix Required*: Refactor tests to feed real strategy-generated `BUY`/`SELL` signals through `onBarClose` with realistic option quotes and verify end-to-end order payloads.

8. **S19-012 (Blocker — Regulatory & Algo Undertaking Compliance)**:
   - *Defect*: 1% limit buffer does not satisfy NSE regulatory requirements alone.
   - *Fix Required*: Document and implement exchange-approved algo identifiers, algo order tagging (`X-Algo-Name` / algo IDs), broker-hosted deployment specifications, and compliance with the November 20, 2026 NSE circular (INSP77559) regarding static IP requirements for qualifying tech-savvy retail investors.
