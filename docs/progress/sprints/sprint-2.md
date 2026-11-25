# 🧪 Sprint 2 — Backtest Engine + Full Test Coverage

> **Start**: 2026-12-01 IST  
> **Target End**: 2026-12-06 IST (6 days)  
> **Status**: ⏳ QUEUED  
> **Gate from Sprint 1.5**: All S1 checklist items green  
> **Gate to Sprint 3**: `bun test` ≥ 90% coverage, backtest runs on fixture data

---

## Goal

Build the backtest engine. Write all strategy-core tests. Bring coverage from 75%/80% → ≥ 90%.

---

## Sprint Checklist

- [ ] `bun test` passes with ≥ 90% strategy-core coverage
- [ ] Backtest runs on fixture NIFTY data for 1 month
- [ ] Manual verify: EMA values match TradingView for same data
- [ ] Instrument index reduces backtest lookup time by >10×
- [ ] All 4 new test files pass

---

## Tickets

### S2-001 — Write crossover.test.ts {#S2-001}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-12-01 |
| **Files** | `packages/strategy-core/test/crossover.test.ts` |

5 test cases:
```
✓ BULLISH when EMA9 crosses above EMA21
✓ BEARISH when EMA9 crosses below EMA21
✓ NONE when no crossover
✓ NONE during NaN warmup period
✓ No false crossover on equal values
```

---

### S2-002 — Write generator.test.ts {#S2-002}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-12-01 |
| **Files** | `packages/strategy-core/test/generator.test.ts` |

7 test cases:
```
✓ Entry only within 09:15–14:30 window
✓ Exit honored outside window (opposite crossover)
✓ 15:00 square-off takes priority over all crossovers
✓ Reversal: exit + entry in same bar within window
✓ Reversal NOT triggered outside window
✓ Exit signal carries correct optionSymbol
✓ No position state leak between days
```

---

### S2-003 — Write instrument-resolver.test.ts {#S2-003}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-12-02 |
| **Files** | `packages/strategy-core/test/instrument-resolver.test.ts` |

6 test cases:
```
✓ DEEP_ITM_BUY + BUY → CE at ATM-5*step
✓ DEEP_ITM_BUY + SELL → PE at ATM+5*step
✓ ATM_BUY → CE at ATM
✓ ATM_SELL → PE at ATM (short put)
✓ Rolls to next expiry when < avoidExpiryDays
✓ Throws when no instrument found
```

---

### S2-004 — Implement backtest/engine.ts {#S2-004}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-12-03 |
| **Files** | `packages/strategy-core/src/backtest/engine.ts` (new) |

Key algorithm:
1. Group candles by trading day
2. For each day: continue EMAs from previous day (no daily reset)
3. `generateSignals()` per day
4. Simulate fill at next 1m open
5. `calculateTradePnL()` with `getCostConfigForDate()`
6. After all days: `calculateMetrics()`

---

### S2-005 — Implement backtest/metrics.ts {#S2-005}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🟡 Important |
| **ETA** | 2026-12-04 |
| **Files** | `packages/strategy-core/src/backtest/metrics.ts` (new) |

Metrics to implement:
- Sharpe ratio (annualized, risk-free = 6.5%)
- Sortino ratio
- Calmar ratio
- Max drawdown (peak-to-trough on equity curve)
- Win rate, profit factor, avg win/loss
- Max consecutive wins/losses

---

### S2-006 — Implement backtest/reporter.ts {#S2-006}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🟡 Important |
| **ETA** | 2026-12-04 |
| **Files** | `packages/strategy-core/src/backtest/reporter.ts` (new) |

- Format results for API response
- Generate equity curve array `{ date, equity }[]`

---

### S2-007 — Add buildInstrumentIndex() {#S2-007}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🟡 Important |
| **ETA** | 2026-12-05 |
| **Files** | `packages/strategy-core/src/execution/instrument-resolver.ts` |

```typescript
export function buildInstrumentIndex(instruments: Instrument[]): Map<string, Instrument[]> {
  const index = new Map<string, Instrument[]>();
  for (const inst of instruments) {
    if (inst.instrumentType !== 'OPT') continue;
    const key = `${inst.underlyingSymbol}:${inst.strikePrice}:${inst.optionType}`;
    if (!index.has(key)) index.set(key, []);
    index.get(key)!.push(inst);
  }
  return index;
}
```

Build index once, reuse per signal in backtest (O(1) vs O(n) per lookup).

---

### S2-008 — Write backtest.test.ts {#S2-008}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-12-05 |
| **Files** | `packages/strategy-core/test/backtest.test.ts` (new) |

6 test cases:
```
✓ Full 5-day backtest with fixture data produces expected trades
✓ EMA is continuous across day boundaries (no daily reset)
✓ P&L matches manual calculation
✓ Costs match dated cost config
✓ 15:00 square-off always closes position
✓ Empty candle day produces no trades
```

---

### S2-009 — Coverage Gate Verification {#S2-009}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-12-06 |

```bash
bun test --coverage
# Target: Functions ≥ 90%, Lines ≥ 90%
```

- [ ] Run coverage report
- [ ] All gaps identified and closed
- [ ] CI enforces coverage threshold (add `--coverage --coverage-threshold` flag)

---

## 🚦 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| EMA continuity across days is broken | Medium | High | Test S2-008 case 2 rigorously with fixture data |
| Backtest P&L diverges from manual calc | Medium | High | Pin fixture data + compute expected P&L by hand first |
| Coverage stuck below 90% | Low | Medium | Map untested branches before writing tests |

---

*Sprint 2 · Target: 2026-12-06 · 9 tickets*
