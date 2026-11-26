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

### S19-006 — Real Strategy Signal Classification & Order Mapping ✅
- **Engine (`apps/engine/src/services/live-trading.ts`)**:
  - Replaced flawed `startsWith('ENTRY')` check with `!Boolean(signal.metadata?.['isExit'])`.
  - Strategy signals (`BUY`/`SELL`) now properly map to `BUY` entries (calls/puts) and `SELL` exits.
  - Entry risk limits are strictly enforced on all entries without being bypassed.

### S19-007 — Real-Time Option Premium Sourcing (`optionPriceLookup`) ✅
- **Engine (`apps/engine/src/services/live-trading.ts` & `apps/engine/src/index.ts`)**:
  - Refactored `onBarClose` to accept `optionPriceLookup` callback wired to `marketData.getLatestPrice()`.
  - Added invariant: Engine strictly rejects live signals if real-time option LTP is unavailable, refusing to fall back to underlying index `spotPrice`.
  - Bounded limit orders are calculated from real option premiums using `EMERGENCY_LIMIT_BUFFER_PCT`.

### S19-008 — Square-Off Fill Confirmation Invariant ✅
- **Engine (`apps/engine/src/services/live-trading.ts`)**:
  - In `squareOffAll`, square-offs submit protected limit orders, record `closeOrderId`, and set position status to `CLOSING` (never `CLOSED` on submission).
  - In `handleOrderUpdate`, positions transition to `CLOSED` only upon verified broker `COMPLETE` fill confirmation. If rejected/cancelled at broker, positions revert to `OPEN`.

### S19-011 — Real-Signal End-to-End Integration Tests ✅
- **Test Suite (`apps/engine/test/live-engine.test.ts`)**:
  - Replaced synthetic `ENTRY_LONG` / `LIVE` test mocks with real production `BUY`/`SELL` signals with `metadata.isExit`.
  - Verified entry risk checks, option price sourcing refusal on missing quote, bounded limit price math, and fill-confirmed square-off state transitions.

---

## 🔒 Remaining Phase 2 Blockers & Invariants (Live Trading Unsafe)

> [!CAUTION]
> **VERDICT: LIVE TRADING REMAINS UNCONDITIONALLY DISABLED (`ENABLE_LIVE_TRADING=false`)**  
> Real capital execution is unsafe and disabled until all remaining Phase 2 architectural prerequisites are completed:

1. **S19-005 (Blocker — 2FA Verification)**:
   - *Requirement*: Implement operator TOTP enrollment and secret storage, accept a user-submitted 6-digit step-up code on `/api/live/enable`, and verify it server-side.
2. **S19-009 (Blocker — In-Memory Volatile State & Missing DB Persistence)**:
   - *Requirement*: Create durable `live_orders` and `live_positions` tables in PostgreSQL with transaction-safe state transitions and hydration on startup.
3. **S19-010 (Blocker — Startup Reconciliation Sequence Ordering)**:
   - *Requirement*: Block feed connection and scheduler startup until startup reconciliation has fully matched broker positions with database state.
4. **S19-012 (Blocker — Regulatory & Algo Undertaking Compliance)**:
   - *Requirement*: Document and implement exchange-approved algo identifiers, algo order tagging (`X-Algo-Name` / algo IDs), broker-hosted deployment specifications, and compliance with the November 20, 2026 NSE circular (INSP77559) regarding static IP requirements for qualifying tech-savvy retail investors.
