# 9/21 EMA Crossover Options Strategy - Corrected Specification v2

## Strategy Overview

**Name**: EMA Crossover Options Strategy  
**Universe**: NIFTY Index Options (extendable to BANKNIFTY, FINNIFTY)  
**Timeframe**: Intraday (resampled from 1-minute bars, aligned to 09:15)  
**Style**: Trend following with mandatory exits  

---

## Core Logic - Corrected

### Signal Generation

```
BUY Signal  : EMA(9) crosses ABOVE EMA(21) on CLOSED resampled bar
SELL Signal : EMA(9) crosses BELOW EMA(21) on CLOSED resampled bar
```

**Critical Rules:**
- Signals only on **closed bars** (use previous completed bar's EMA values)
- EMAs run **continuously across sessions** (no daily reset)
- EMA seeding: First EMA = SMA of first N closes; first N-1 values = NaN
- No signal generated during warm-up period

### Timeframe Resampling (Aligned to 09:15 IST)

| Base | Target | Bar Boundaries |
|------|--------|----------------|
| 1m   | 5m     | 09:15-09:20, 09:20-09:25, ..., 15:10-15:15, 15:15-15:20, 15:20-15:25, 15:25-15:30 |
| 1m   | 15m    | 09:15-09:30, 09:30-09:45, ..., 14:45-15:00, 15:00-15:15, 15:15-15:30 |
| 1m   | 30m    | 09:15-09:45, 09:45-10:15, ..., 14:15-14:45, 14:45-15:15, 15:15-15:30 (short) |

**Note**: 15:00 square-off happens mid-bar for 15m/30m timeframes. Exit at 15:00 uses **last tick before 15:00**, not bar close.

---

## Entry Rules

### Entry Window (Configurable)

| Parameter | Options | Default |
|-----------|---------|---------|
| Window Start | 09:30, 10:00, 10:30 | 09:30 |
| Window End | 11:30, 12:00, 12:30, 13:00, 13:30, 14:00, 14:30 | 11:30 |

**Rule**: 
- **Entries**: Only allowed within entry window
- **Exits**: Always honored (opposite crossover, 15:00 square-off, risk limits) — **NOT gated by entry window**
- Signals outside window: Logged but **no position entry**

### Entry Execution

On valid signal within window:
1. Determine option strike & type based on execution mode
2. Place order at **next 1-minute candle OPEN** (both entry and exit)
3. For paper: fill at **ask (buy)** / **bid (sell)** with spread
4. Record: entry price, time, strike, IV, greeks, bid/ask at fill

---

## Exit Rules (Priority Order)

### 1. Mandatory Square-Off (Highest Priority)
- **Time**: 15:00 IST sharp
- **Price**: Last available tick before 15:00 (or 15:00 candle open)
- **Applies to**: ALL open positions regardless of execution mode
- **Order type**: Market order (unconditional fill)

### 2. Opposite Crossover (Standard Exit)
- Long: Exit when EMA(9) crosses **below** EMA(21) on closed bar
- Short: Exit when EMA(9) crosses **above** EMA(21) on closed bar
- **Exit at**: Next 1m candle open after crossover confirmation
- **Applies**: Always, even outside entry window

### 3. Risk Limits (Protective Exit)
- Daily loss > 2% of capital → Close all positions
- Max positions exceeded → Reject new entries
- Per-trade risk > 1% → Position sizing prevents this

### 4. Immediate Reversal (Within Window Only)
```
Scenario: Long position open → Bearish crossover INSIDE entry window
Action:
  1. Close long at next 1m open (crossover bar + 1)
  2. Open NEW short position at next 1m open (separate trade)
  3. Each leg fills at its own instrument's bid/ask
  
Rule: Reversal ONLY if new signal falls within entry window
      Opposite crossover OUTSIDE window → Exit only, no new entry
```

---

## Execution Modes (All Compared in UI)

| Mode | Signal | Option Type | Strike Selection | Direction |
|------|--------|-------------|------------------|-----------|
| **Deep ITM Buy** | BUY | Call (CE) | ATM - 5 strikes (ITM) | Long Call |
| **Deep ITM Buy** | SELL | Put (PE) | ATM + 5 strikes (ITM) | Long Put |
| **ATM Buy** | BUY | Call (CE) | ATM | Long Call |
| **ATM Buy** | SELL | Put (PE) | ATM | Long Put |
| **ATM Sell** | BUY | Put (PE) | ATM | Short Put |
| **ATM Sell** | SELL | Call (CE) | ATM | Short Call |

### Strike Selection Logic (Corrected)

```typescript
// Spot price at signal time: S
// ATM Strike = round(S / strikeStep) * strikeStep

function selectStrike(
  spot: number, 
  signal: 'BUY' | 'SELL', 
  mode: ExecutionMode,
  strikeOffset: number,
  strikeStep: number
): { strike: number; optionType: 'CE' | 'PE' } {
  const atm = Math.round(spot / strikeStep) * strikeStep;
  
  switch (mode) {
    case 'DEEP_ITM_BUY':
      if (signal === 'BUY') {
        return { strike: atm - (strikeOffset * strikeStep), optionType: 'CE' };
      } else {
        return { strike: atm + (strikeOffset * strikeStep), optionType: 'PE' };
      }
      
    case 'ATM_BUY':
      if (signal === 'BUY') {
        return { strike: atm, optionType: 'CE' };
      } else {
        return { strike: atm, optionType: 'PE' };
      }
      
    case 'ATM_SELL':
      if (signal === 'BUY') {
        return { strike: atm, optionType: 'PE' };  // Short Put
      } else {
        return { strike: atm, optionType: 'CE' };  // Short Call
      }
  }
}
```

### Expiry Selection

| Preference | Rule |
|------------|------|
| Primary | Nearest **weekly** expiry (Thursday) |
| Avoid | Last 2 trading days before expiry (liquidity/gamma risk) |
| Roll | If current expiry within 2 days → Use next weekly |
| Fallback | Monthly expiry if no weekly available |

---

## Position Sizing & Risk

| Parameter | Value | Notes |
|-----------|-------|-------|
| Lot Size | From `instruments` table (dated) | NIFTY: 75 (current), was 65, was 50 |
| Lots per Trade | 1 (configurable) | |
| Max Concurrent Positions | **Per account**: 3 total | Across all strategies/modes |
| Max per Strategy | 1 position | No pyramiding |
| Daily Loss Limit | 2% of capital | Hard stop - close all |
| Per-Trade Risk | 1% of capital | Via position sizing |

### Margin Requirements (Live Trading)

| Mode | Margin Type | Approx. per NIFTY Lot |
|------|-------------|----------------------|
| Deep ITM Buy | Premium + SPAN | ~₹15,000 - ₹25,000 |
| ATM Buy | Premium + SPAN | ~₹8,000 - ₹15,000 |
| ATM Sell | **SPAN + Exposure** | **~₹1,00,000 - ₹1,50,000** |

**Warning**: ATM Sell requires full margin. Paper trading simulates this.

### Stop-Loss for Short Options (ATM Sell)
- **Hard stop**: If premium doubles from entry → Force close
- **Trailing**: If move > 50% against → Close
- **Time stop**: Mandatory 15:00 exit always applies

---

## Cost Model (Dated Configuration)

### Transaction Costs per Leg (Per Lot)

| Cost Component | Rate (2024+) | Applied On |
|----------------|--------------|------------|
| Brokerage | ₹20 per order | Both sides |
| STT | **0.1%** of premium (sell side) | Exit (buy) / Entry (sell) |
| Exchange TXN | **0.05%** of premium | Both sides |
| GST | 18% on (brokerage + exchange) | Both sides |
| SEBI Fees | ₹10 per crore | Both sides |
| Stamp Duty | 0.003% (buy side) | Entry (buy) / Exit (sell) |
| Slippage | **Spread-based** (see below) | Both sides |

### Slippage Model (Realistic)

```typescript
// Instead of fixed tick, use bid-ask spread
function calculateSlippage(bid: number, ask: number, side: 'BUY' | 'SELL'): number {
  const spread = ask - bid;
  const mid = (bid + ask) / 2;
  
  // Model as fraction of spread based on urgency
  const slippagePct = 0.5; // 50% of spread for market orders
  
  if (side === 'BUY') {
    return ask + (spread * slippagePct) - mid; // Additional cost vs mid
  } else {
    return mid - (bid - (spread * slippagePct));
  }
}

// For backtest without bid/ask: assume spread = max(0.10, premium * 0.01)
```

### Cost Config Table (Database)

```sql
CREATE TABLE cost_configs (
    id BIGSERIAL PRIMARY KEY,
    effective_from DATE NOT NULL,
    effective_to DATE,
    brokerage_per_order NUMERIC(10,2) NOT NULL,
    stt_pct NUMERIC(8,6) NOT NULL,        -- 0.001 = 0.1%
    exchange_pct NUMERIC(8,6) NOT NULL,
    gst_pct NUMERIC(6,4) NOT NULL,        -- 0.18
    sebi_per_crore NUMERIC(10,2) NOT NULL,
    stamp_pct NUMERIC(8,6) NOT NULL,      -- 0.00003
    default_spread_pct NUMERIC(6,4),      -- For modelled data
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Only one active at a time
```

---

## Backtest Methodology (Rigorous)

### Data Requirements

| Data | Source | Notes |
|------|--------|-------|
| NIFTY Spot 1m | Groww / NSE | Required for signals |
| Option Chain 1m | Groww | **Critical**: Verify availability for expired contracts |
| Bid/Ask 1m | Groww | For realistic fills |
| IV/Greeks | Groww | Nullable for historical |

**If option history unavailable**: Label runs as **MODELLED** (Black-Scholes with flat IV) — not market backtests.

### Event-Driven Simulation (Corrected)

```
For each trading day (chronological):
  1. Load 1m candles for spot + required options
  2. Resample to target timeframe (5m/15m/30m) aligned to 09:15
  3. Calculate EMAs continuously (carry forward from prior day)
  4. For each resampled bar (closed):
     a. Detect crossover
     b. If crossover & in entry window → Generate signal
     c. Select strike/expiry based on config
     d. Simulate entry at NEXT 1m open (bid/ask)
  5. For each open position:
     a. Check 15:00 square-off (highest priority)
     b. Check opposite crossover on closed resampled bar
     c. Check risk limits
     d. Check reversal (new signal in window)
  6. On exit → Calculate P&L with dated cost config
  7. Record trade + signal audit trail
```

### Walk-Forward Validation (Anti-Overfitting)

| Split | Period | Purpose |
|-------|--------|---------|
| Train | First 60% | Parameter selection |
| Validation | Next 20% | Model selection |
| Test | Final 20% | Final performance |

**Parameter Grid**: 3 start × 7 end × 3 timeframe × 3 modes = **189 combos**
- Report: **All** results on validation, not just best
- Select: Top 3 by Sharpe on validation → Test on test set
- Report: Test set metrics for selected variants

### Minimum Trade Count
- Paper trading gate: **100+ trades** (not 20 days)
- ~1-2 trades/day → 50-100 trading days minimum
- Statistical significance: Win rate CI, profit factor CI

---

## Trade Auditor Requirements (Detailed)

### Chart Display
- **Primary**: 1-minute candlesticks (±30 minutes around trade entry)
- **Overlay**: 9 & 21 EMA on **selected timeframe** (5m/15m/30m)
- **Markers**: 
  - ▲ Entry (green=long, red=short) at entry price
  - ▼ Exit (opposite color) at exit price
  - ⬤ Reversal: both markers at same timestamp
- **Tooltips**: Time, Price, EMA9/EMA21, P&L, Strike, IV, Bid/Ask at fill

### Navigation
- ← / → keys: Previous/Next trade (chronological)
- Dropdown: Filter by strategy, date range, outcome, mode
- Sync: Click trade in list → Jump to chart + highlight

### Context Panel (Right Sidebar)
- Option chain snapshot at entry (±10 strikes)
- IV term structure (if available)
- Greeks at entry (Delta, Gamma, Theta, Vega) — **nullable**
- Market breadth (A/D ratio, VIX) at entry time
- Cost breakdown for the trade

---

## Paper Trading Rules

### Virtual Portfolio
- Starting Capital: ₹10,00,000 (configurable per user)
- Margin: Simulate SPAN + Exposure for each mode
- **No margin benefit** for options buy (full premium)
- **Full margin** for options sell (SPAN + Exposure)

### Execution Simulation
- Fill at next 1m candle **ask (buy)** / **bid (sell)**
- Spread from historical data or modelled
- Partial fills: Not simulated (assume full fill at VWAP)
- Rejection: On insufficient margin or risk limit breach

### Risk Checks (Pre-trade, Server-side)
- [ ] Daily realized P&L > -2% of day-start capital
- [ ] Open positions < 3 (account level)
- [ ] Sufficient cash for margin (mode-specific)
- [ ] Not in blocked period (configurable)
- [ ] Strategy-specific: max 1 position per strategy

---

## Live Trading Rules (Gated, Server-Enforced)

> **Implementation status (2026-11-26): live enable is blocked in both API and engine until operator 2FA is implemented. This section is a target design, not a statement that live execution is production-ready. Validate all order behavior with the broker and current exchange rules before deployment.**

### Prerequisites (All Required)
- [ ] Paper trading: **100+ trades** with positive expectancy
- [ ] Profit factor > 1.5 on paper (validation period)
- [ ] Max drawdown < 10% on paper
- [ ] User completes **2FA verification** (Better Auth)
- [ ] Explicit "Enable Live Trading" per session (API call)
- [ ] Risk limits configured and acknowledged in UI
- [ ] Emergency stop tested (small qty)

### Execution (Target Design; Requires Broker and Exchange Approval)
- Use only order types and price protections approved for the broker, segment, and registered algo setup; do not assume market orders or market fallbacks are permitted.
- Keep emergency close orders bounded and tracked. A submitted close order is not a fill; retain the position as open until broker updates or reconciliation confirm it is flat.
- Run end-of-session square-off through the same durable order and fill-tracking path.
- Emergency stop is asynchronous: it queues cancellations and protected limit close requests. Display command status and require broker-position verification before reporting the account flat.
- Persist order IDs, idempotency keys, partial fills, and position transitions; reconcile broker state before enabling live order generation.

### Server-Side Enforcement (Cannot Bypass)
```typescript
// Every order placement goes through this
async function placeOrder(params: OrderParams, userId: string) {
  // 1. Verify live trading enabled for user
  // 2. Check daily loss limit (realized P&L)
  // 3. Check position limits
  // 4. Check margin availability
  // 5. Generate idempotency key (store before API call)
  // 6. Place order with Groww
  // 7. Record in live_fills with PENDING status
  // 8. Update reconciliation_state
}
```

### Monitoring Dashboard (Real-time)
- Positions with Greeks, unrealized P&L
- Margin utilization (% of available)
- Order status feed (pending/open/complete/rejected)
- Daily P&L vs limit (visual progress bar)
- Kill switch button (prominent, confirmed)

---

## Configuration Schema (TypeScript - Final)

```typescript
type Timeframe = '5m' | '15m' | '30m';
type ExecutionMode = 'DEEP_ITM_BUY' | 'ATM_BUY' | 'ATM_SELL';
type SignalType = 'BUY' | 'SELL';
type TradeSide = 'LONG' | 'SHORT';
type ExitReason = 'OPPOSITE_CROSSOVER' | 'SQUARE_OFF_1500' | 'REVERSAL' 
                | 'DAILY_LOSS_LIMIT' | 'MARGIN_CALL' | 'MANUAL' | 'STOP_LOSS_SHORT';

interface StrategyConfig {
  // Identity
  id?: string;
  name: string;
  underlyingSymbol: 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY';
  
  // Timeframe
  timeframe: Timeframe;
  
  // Entry Window (entries only)
  entryWindow: {
    start: string;  // "HH:mm" e.g., "09:30"
    end: string;    // "HH:mm" e.g., "11:30"
  };
  
  // Exit
  exitTime: string;  // "15:00" (fixed)
  
  // Execution
  executionMode: ExecutionMode;
  strikeOffset: number;     // Strikes from ATM (5 = 250 pts for NIFTY)
  lots: number;             // 1
  
  // Expiry
  expiryPreference: 'WEEKLY' | 'MONTHLY';
  avoidExpiryDays: number;  // 2
  
  // Risk (server-enforced)
  risk: {
    maxDailyLossPct: number;      // 2
    maxPositions: number;         // 3 (account level)
    maxPositionsPerStrategy: number; // 1
    perTradeRiskPct: number;      // 1
    blockedPeriods: string[];     // ["09:15-09:30", "15:15-15:30"]
    shortOptionStopLossPct: number;  // 100 (premium doubles)
  };
  
  // Costs (dated - fetched from DB at runtime)
  // costConfigId?: string;  // References cost_configs table
}

interface Signal {
  strategyId: string;
  runType: 'backtest' | 'paper' | 'live';
  barTime: Date;              // Signal bar CLOSE time
  signalType: SignalType;
  ema9: number;
  ema21: number;
  spotPrice: number;
  selectedStrike: number;
  optionType: 'CE' | 'PE';
  optionSymbol: string;       // Groww token
  expiryDate: Date;
  entryWindowValid: boolean;
  isReversal: boolean;
  currentPosition: TradeSide | null;
  metadata: Record<string, unknown>;
}

interface Trade {
  signalId?: string;
  optionSymbol: string;
  side: TradeSide;
  entryTime: Date;
  entryPrice: number;         // Fill price (bid/ask)
  exitTime?: Date;
  exitPrice?: number;
  quantity: number;           // lots * lotSize
  grossPnl?: number;
  costs?: number;
  netPnl?: number;
  exitReason?: ExitReason;
  fillMetadata: {
    bid: number;
    ask: number;
    spread: number;
    slippage: number;
  };
  metadata: Record<string, unknown>;
}
```

---

## Validation Checklist (Updated)

### Before Backtest
- [ ] 1m spot data: No gaps, correct timestamps, continuous across days
- [ ] Option 1m data: **Verify availability for expired contracts** (critical)
- [ ] Resampling: 09:15 alignment verified for all timeframes
- [ ] EMA: Continuous across sessions, warm-up = 20 bars NaN
- [ ] Crossover: On CLOSED bars only (no look-ahead)
- [ ] Strike selection: Deep ITM Call = ATM-5, Deep ITM Put = ATM+5
- [ ] ATM Sell mapping: BUY→Short Put, SELL→Short Call
- [ ] Expiry logic: Weekly preferred, avoid last 2 days
- [ ] Cost config: Dated, matches current broker schedule
- [ ] Slippage: Spread-based, sensitivity tested at 1x, 2x, 3x

### Before Paper Trading
- [ ] Walk-forward validation completed (train/val/test)
- [ ] All 189 param combos reported on validation set
- [ ] Selected variants profitable on test set
- [ ] 100+ trades in paper with positive metrics
- [ ] WebSocket reconnection + state recovery tested
- [ ] Emergency stop tested
- [ ] Margin simulation matches live requirements

### Before Live Trading
- [ ] Paper: 100+ trades, PF > 1.5, DD < 10%
- [ ] All risk limits server-enforced (not client)
- [ ] 2FA enabled, live trading approval flow works
- [ ] Groww API credentials valid, token refresh tested
- [ ] Emergency stop tested with real orders (1 lot)
- [ ] Idempotency keys prevent duplicate orders
- [ ] Reconciliation on startup recovers positions correctly
- [ ] Tax implications confirmed with CA (F&O = business income)

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Market holiday | Skip day - no data, no signals |
| Partial day (Muhurat) | Use actual open/close times |
| Gap up/down open | EMAs continuous from prior close |
| Option expiry week | Roll to next weekly if < 2 days |
| 15:00 crossover exactly | Square-off takes priority |
| WebSocket disconnect | Reconnect + backfill missing 1m bars |
| API rate limit | Queue with exponential backoff |
| Invalid strike (delisted) | Skip trade, log warning, alert |
| Corporate action | Adjust historical data via instrument master |
| Groww order reject | Record in live_fills with REJECTED, alert |
| Partial fill | Track filled_qty, avg_price; retry remainder |

---

*Strategy Spec v2.0 (corrected per review)*
*2026-11-24*
