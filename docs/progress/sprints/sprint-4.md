# ⚙️ Sprint 4 — Engine Paper Trading (Working E2E)

> **Start**: 2026-12-15 IST  
> **Target End**: 2026-12-22 IST (8 days)  
> **Status**: ⏳ QUEUED  
> **Gate from Sprint 3**: API functional; WS connects  
> **Gate to Sprint 5**: Paper session E2E works; scheduler runs

---

## Goal

Paper trading works end-to-end: start session → receive WebSocket tick → position opened → P&L tracked → stop session cleanly.

---

## Sprint Checklist

- [ ] Paper session starts, generates signals, creates positions in DB
- [ ] Paper portfolio balance updates on each fill
- [ ] Emergency stop closes all positions (verify via DB)
- [ ] Scheduler runs and candle data appears in DB at 15:30 IST
- [ ] WebSocket reconnect recovers session within 30 seconds

---

## Tickets

### S4-001 — loadStrategy() in command-processor.ts {#S4-001}
| **ETA** | 2026-12-15 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Query `strategies` table via Drizzle. Return typed `StrategyConfig`.

### S4-002 — loadInstruments() {#S4-002}
| **ETA** | 2026-12-15 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Query `instruments` where `is_active = true` and `valid_to IS NULL OR valid_to >= now()`.

### S4-003 — closeAllPaperPositions() {#S4-003}
| **ETA** | 2026-12-16 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Load open paper positions → emit SELL signal → update DB `paper_positions` and `paper_portfolios`.

### S4-004 — closeAllLivePositions() + cancelAllOrders() {#S4-004}
| **ETA** | 2026-12-16 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Place market orders via GrowwClient. Cancel pending `live_fills`. Update DB.

### S4-005 — WebSocketManager with Exponential Backoff {#S4-005}
| **ETA** | 2026-12-17 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

```typescript
reconnectDelay: 1s → 2s → 4s → ... → 60s cap
onDisconnect: backfill missing bars → reseed EMAs → reset delay on success
```

### S4-006 — Backfill Missing Bars on Reconnect {#S4-006}
| **ETA** | 2026-12-17 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Fetch missing 1m candles via `GrowwClient.getHistoricalCandles(from, to)`. Insert into `candles_1m`. Trigger resampling for affected timeframes. Reseed EMAs from recovered data.

### S4-007 — paper-engine.ts: Bar Aggregation {#S4-007}
| **ETA** | 2026-12-18 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Real-time 1m tick → aggregate into current resampled bar. On bar close: call `generator.processBar()`.

### S4-008 — paper-engine.ts: Risk Checks + Fill Simulation {#S4-008}
| **ETA** | 2026-12-18 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

For each signal:
1. Daily loss limit check
2. Max positions check
3. Margin/capital check
4. Market hours check
5. Simulate fill at bid/ask midpoint
6. Insert `paper_trades`, update `paper_positions`, update `paper_portfolios`
7. Publish via PostgreSQL NOTIFY

### S4-009 — paper-engine.ts: MTM Per Tick {#S4-009}
| **ETA** | 2026-12-19 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Update MTM P&L on every tick for open positions. Update `paper_portfolios.total_value` and `unrealized_pnl`.

### S4-010 — Scheduler: downloadDayCandles (15:30 IST) {#S4-010}
| **ETA** | 2026-12-19 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

```typescript
cron.schedule('30 15 * * 1-5', async () => {
  await downloadDayCandles(today);
  await resampleCandles(today);
});
```

> **IST NOTE**: All cron times in IST. Scheduler runs in IST timezone (Asia/Kolkata). Never use UTC offsets for cron here.

### S4-011 — Scheduler: syncInstrumentMaster (Mon 09:00 IST) {#S4-011}
| **ETA** | 2026-12-20 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Fetch current option chain, update `instruments` table. Deactivate expired instruments.

### S4-012 — DB Migration: closedReason Column {#S4-012}
| **ETA** | 2026-12-20 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Migration `0003_positions_closed_reason`: add `closed_reason VARCHAR(50)` to `live_positions` and `paper_positions`.

### S4-013 — E2E Test: Paper Session Flow {#S4-013}
| **ETA** | 2026-12-21 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Script or test: start paper session → inject mock tick → assert position created in DB → stop session → assert position closed.

### S4-014 — E2E Test: Emergency Stop {#S4-014}
| **ETA** | 2026-12-22 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Open paper position → trigger emergency stop → assert all positions closed → assert `paper_portfolios` updated.

---

*Sprint 4 · Target: 2026-12-22 · 14 tickets*
