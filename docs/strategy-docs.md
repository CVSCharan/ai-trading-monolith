# 9/21 EMA Crossover Options Strategy - Specification

## Strategy Overview

**Name**: EMA Crossover Options Strategy  
**Universe**: NIFTY Index Options (extendable to BANKNIFTY, FINNIFTY)  
**Timeframe**: Intraday (resampled from 1-minute bars)  
**Style**: Trend following with mean reversion exit  

---

## Core Logic

### Signal Generation

```
BUY Signal  : EMA(9) crosses ABOVE EMA(21) on CLOSED bar
SELL Signal : EMA(9) crosses BELOW EMA(21) on CLOSED bar
```

**Critical**: Signals only generated on **closed bars** (not forming bar). Use previous completed bar's EMA values.

### Timeframe Resampling

| Base | Target | Alignment |
|------|--------|-----------|
| 1m   | 5m     | 09:15, 09:20, 09:25... |
| 1m   | 15m    | 09:15, 09:30, 09:45... |
| 1m   | 30m    | 09:15, 09:45, 10:15... |

**Alignment Rule**: All resampled bars anchored to market open (09:15 IST). First 5m bar = 09:15-09:20, not 09:15-09:19:59.

---

## Entry Rules

### Entry Window (Configurable)

| Parameter | Options | Default |
|-----------|---------|---------|
| Window Start | 09:30, 10:00, 10:30 | 09:30 |
| Window End | 11:30, 12:00, 12:30, 13:00, 13:30, 14:00, 14:30 | 11:30 |

**Rule**: Signals generated **outside** this window are **ignored completely**. No position entry, no signal logging for trading purposes.

### Entry Execution

On valid signal within window:
1. Determine option strike based on execution mode
2. Place market order at **next available tick** (simulate: next 1m candle open)
3. Record entry price, time, strike, IV, greeks

---

## Exit Rules

### Primary Exit: Opposite Crossover
- Long position: Exit when EMA(9) crosses **below** EMA(21)
- Short position: Exit when EMA(9) crosses **above** EMA(21)
- Exit at next tick after crossover confirmation (closed bar)

### Mandatory Square-Off
- **Hard exit at 15:00 IST** regardless of position
- Exit at 15:00 candle close price (or last available tick)

### Immediate Reversal (Critical Feature)
```
Scenario: Long position open → Bearish crossover INSIDE entry window
Action: 
  1. Close long at crossover price
  2. Immediately OPEN short position at same price
  3. Treat as single continuous trade for P&L? NO - separate trades
  
Rule: Reversal only allowed IF new signal falls within entry window
```

---

## Execution Modes (All Compared in UI)

| Mode | Strike Selection | Direction | Use Case |
|------|------------------|-----------|----------|
| **Deep ITM Buy** | ATM - 5 strikes (ITM 5) | BUY (Long) | Lower premium, higher delta, directional |
| **ATM Buy** | At-the-money | BUY (Long) | Balanced delta/theta, standard |
| **ATM Sell** | At-the-money | SELL (Short) | Theta decay, mean reversion bias |

### Strike Selection Logic

```typescript
// Spot price at signal time: S
// ATM Strike = round(S / 50) * 50  (NIFTY step = 50)

function selectStrike(spot: number, mode: ExecutionMode): number {
  const atm = Math.round(spot / 50) * 50;
  
  switch (mode) {
    case 'DEEP_ITM_BUY':
      return atm - (5 * 50);  // 5 strikes ITM (Call) or +5 for Put
    case 'ATM_BUY':
    case 'ATM_SELL':
      return atm;
  }
}

// Option Type:
// BUY signal  → Buy CALL (Deep ITM or ATM)
// SELL signal → Buy PUT (Deep ITM or ATM) OR Sell CALL/PUT (ATM Sell)
```

### Position Sizing

| Parameter | Value |
|-----------|-------|
| Lot Size | 65 (NIFTY) |
| Lots per Trade | 1 (configurable) |
| Max Concurrent Positions | 1 per strategy (no pyramiding) |

---

## Cost Model (Realistic Backtesting)

### Transaction Costs per Leg

| Cost Component | Rate | Applied On |
|----------------|------|------------|
| Brokerage | ₹20 per order | Entry + Exit |
| STT (Sell side) | 0.05% of premium | Exit (buy) / Entry (sell) |
| Exchange TXN | 0.053% of premium | Both sides |
| GST | 18% on (brokerage + exchange) | Both sides |
| SEBI Fees | ₹10 per crore | Both sides |
| Stamp Duty | 0.003% (buy side) | Entry (buy) / Exit (sell) |
| Slippage | 1 tick (0.05) | Both sides (simulated) |

### Example Cost Calculation (1 Lot NIFTY)

```
Premium: ₹200
Quantity: 65

Entry (Buy):
  Brokerage: ₹20
  Exchange: 200 * 65 * 0.00053 = ₹6.89
  GST: (20 + 6.89) * 0.18 = ₹4.84
  Stamp: 200 * 65 * 0.00003 = ₹0.39
  SEBI: (200 * 65) / 1e7 * 10 = ₹0.13
  Slippage: 0.05 * 65 = ₹3.25
  Total Entry: ~₹35.50

Exit (Sell):
  Brokerage: ₹20
  STT: 200 * 65 * 0.0005 = ₹6.50
  Exchange: ₹6.89
  GST: ₹4.84
  SEBI: ₹0.13
  Slippage: ₹3.25
  Total Exit: ~₹41.61

Round Trip: ~₹77 per lot
```

---

## Backtest Methodology

### Data Requirements
- 1-minute OHLCV for NIFTY spot
- 1-minute OHLCV for all option strikes (or reconstruct from spot + IV)
- Date range: Minimum 6 months, ideal 2+ years

### Event-Driven Simulation

```
For each 1-minute candle (chronological):
  1. Update resampled candles (5m/15m/30m)
  2. Calculate EMAs on resampled timeframe
  3. Check for crossovers on CLOSED resampled bars
  4. If crossover & in entry window → Generate signal
  5. If signal → Select strike → Simulate entry at next 1m open
  6. If position open → Check exit conditions:
     a. Opposite crossover on closed resampled bar
     b. Time >= 15:00
     c. Immediate reversal (new signal in window)
  7. On exit → Calculate P&L with costs
  8. Record trade
```

### Performance Metrics

| Metric | Formula |
|--------|---------|
| Net P&L | Σ(Trade P&L) - Σ(Costs) |
| Win Rate | Winning Trades / Total Trades |
| Profit Factor | Gross Profit / Gross Loss |
| Sharpe Ratio | (Mean Daily Return - Risk Free) / StdDev Daily Return |
| Max Drawdown | Peak-to-trough equity decline |
| Avg Win / Avg Loss | Mean of winning/losing trades |
| Max Consecutive Wins/Losses | Streak analysis |
| Calmar Ratio | Annual Return / Max Drawdown |
| Sortino Ratio | Downside deviation only |

---

## Trade Auditor Requirements

### Chart Display
- **Primary**: 1-minute candlesticks (±30 minutes around trade)
- **Overlay**: 9 & 21 EMA on selected timeframe (5m/15m/30m)
- **Markers**: 
  - ▲ Entry (green/red for long/short)
  - ▼ Exit (opposite color)
  - ⬤ Reversal (both markers at same time)
- **Tooltips**: Time, Price, EMA values, P&L, Strike, IV

### Navigation
- ← / → keys: Previous/Next trade
- Dropdown: Filter by strategy, date range, outcome
- Sync: Click trade in list → Jump to chart

### Context Panel
- Option chain snapshot at entry (strikes ±10)
- IV term structure
- Greeks at entry
- Market breadth (advance/decline) at entry time

---

## Paper Trading Rules

### Virtual Portfolio
- Starting Capital: ₹10,00,000 (configurable)
- Margin: SPAN + Exposure (simulate ~15% for options buy)
- No margin for options sell (full cash secured)

### Execution Simulation
- Fill at next 1m candle open
- Partial fills: Not simulated (assume full fill)
- Slippage: 1 tick (0.05) each side
- Rejection: Only on insufficient margin

### Risk Checks (Pre-trade)
- [ ] Daily loss < 2% of capital
- [ ] Open positions < 3
- [ ] Sufficient cash for margin
- [ ] Not in blocked period (first 15min, last 15min)

---

## Live Trading Rules (Gated)

### Prerequisites
- [ ] Paper trading profitable for 20+ trading days
- [ ] User completes 2FA verification
- [ ] Explicit "Enable Live Trading" per session
- [ ] Risk limits configured and acknowledged

### Execution
- Real orders via Groww API
- Market orders for entry (speed)
- Limit orders for exit (price control)
- WebSocket position monitoring
- Emergency stop: Cancel all + Market close all

### Monitoring
- Real-time P&L dashboard
- Position Greeks display
- Margin utilization
- Order status feed

---

## Configuration Schema (TypeScript)

```typescript
interface StrategyConfig {
  // Identity
  id?: string;
  name: string;
  symbol: 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY';
  
  // Timeframe
  timeframe: '5m' | '15m' | '30m';
  
  // Entry Window
  entryWindow: {
    start: '09:30' | '10:00' | '10:30';
    end: '11:30' | '12:00' | '12:30' | '13:00' | '13:30' | '14:00' | '14:30';
  };
  
  // Exit
  exitTime: '15:00';  // Fixed for now
  
  // Execution
  executionMode: 'DEEP_ITM_BUY' | 'ATM_BUY' | 'ATM_SELL';
  lotSize: number;     // 65 for NIFTY
  lots: number;        // 1
  strikeOffset: number; // 5 for Deep ITM
  
  // Risk
  risk: {
    maxDailyLossPct: number;    // 2
    maxPositions: number;       // 3
    perTradeRiskPct: number;    // 1
    blockedPeriods: string[];   // ['09:15-09:30', '15:15-15:30']
  };
  
  // Costs (for backtest)
  costs: {
    brokerage: number;      // 20
    sttPct: number;         // 0.0005
    exchangePct: number;    // 0.00053
    gstPct: number;         // 0.18
    sebiPerCr: number;      // 10
    stampPct: number;       // 0.00003
    slippageTicks: number;  // 1
  };
}
```

---

## Validation Checklist

### Before Backtest
- [ ] 1m data quality: No gaps, correct timestamps
- [ ] Resampling alignment verified (09:15 anchor)
- [ ] EMA calculation matches TradingView/ChartIQ
- [ ] Crossover detection on CLOSED bars only
- [ ] Entry window filtering correct
- [ ] Strike selection logic verified
- [ ] Cost model matches broker schedule

### Before Paper Trading
- [ ] Backtest shows positive expectancy (>1.5 profit factor)
- [ ] Max drawdown < 10%
- [ ] Win rate > 40%
- [ ] Slippage assumptions validated
- [ ] WebSocket reconnection tested
- [ ] Emergency stop tested

### Before Live Trading
- [ ] Paper trading: 20+ days, positive P&L
- [ ] All risk limits configured
- [ ] 2FA enabled and tested
- [ ] Groww API credentials valid
- [ ] Emergency stop tested with real orders (small qty)
- [ ] Tax implications understood (STCG vs LTCG)

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Market holiday | Skip - no data, no signals |
| Partial trading day (Muhurat) | Use actual open/close times |
| Gap up/down open | EMAs calculate from first bar |
| Option expiry day | Avoid last 2 days (liquidity) |
| Corporate action (split) | Adjust historical data |
| WebSocket disconnect | Reconnect + backfill missing candles |
| API rate limit | Queue requests, exponential backoff |
| Invalid strike (delisted) | Skip trade, log warning |
| 15:00 crossover exactly | Square-off takes priority |

---

*Strategy Spec v1.0*
*2026-11-24*