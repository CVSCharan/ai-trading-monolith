# Phase 1 Implementation Specification

## Decisions Based on Review

| Issue | Decision |
|-------|----------|
| **Auth** | Better Auth owns `users` table; we add `user_profiles` for trading prefs |
| **Lot Size** | `instruments` table with validity periods; fetched at runtime |
| **Live Engine** | Long-lived Bun process (systemd/Docker), not edge functions |
| **Trades Table** | Split: `backtest_trades`, `paper_trades`, `live_fills` |
| **Indicators** | Compute on read; `candles_resampled` stores raw OHLCV only |
| **EMA Seeding** | Continuous across sessions; warm-up from prior N bars |
| **Paper Fills** | Bid/Ask simulation with configurable spread |
| **TOTP Encryption** | Envelope encryption; master key from OS keychain/env (not DB) |
| **Order Idempotency** | Client-generated UUID stored before API call |
| **State Recovery** | Reconcile on startup: Groww positions + DB open trades |

---

## Updated Database Schema

```sql
-- ============================================
-- BETTER AUTH TABLES (managed by Better Auth)
-- ============================================
-- user, session, account, verification, passkey
-- We DO NOT create our own users table

-- ============================================
-- EXTENSION: Trading Profile
-- ============================================
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    paper_capital DECIMAL(15,2) DEFAULT 1000000,
    risk_limits JSONB DEFAULT '{
        "maxDailyLossPct": 2,
        "maxPositions": 3,
        "perTradeRiskPct": 1,
        "blockedPeriods": ["09:15-09:30", "15:15-15:30"]
    }'::jsonb,
    live_trading_enabled BOOLEAN DEFAULT FALSE,
    live_trading_approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INSTRUMENT MASTER (Critical for lot sizes)
-- ============================================
CREATE TABLE instruments (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,           -- NIFTY, BANKNIFTY
    instrument_type VARCHAR(20) NOT NULL,  -- INDEX, FUT, OPT
    name VARCHAR(200),                     -- NIFTY 50
    exchange VARCHAR(20) DEFAULT 'NSE',
    segment VARCHAR(20) DEFAULT 'FO',
    lot_size INTEGER NOT NULL,
    tick_size DECIMAL(10,4) NOT NULL DEFAULT 0.05,
    strike_step INTEGER,                   -- 50 for NIFTY, 100 for BANKNIFTY
    expiry_type VARCHAR(20),               -- WEEKLY, MONTHLY
    underlying_symbol VARCHAR(50),         -- NIFTY for options
    strike_price DECIMAL(12,2),            -- for options
    option_type VARCHAR(10),               -- CE, PE for options
    expiry_date DATE,                      -- for options/futures
    is_active BOOLEAN DEFAULT TRUE,
    valid_from DATE NOT NULL,              -- lot size validity
    valid_to DATE,                         -- NULL = current
    groww_token VARCHAR(100),              -- Groww instrument token
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, instrument_type, expiry_date, strike_price, option_type, valid_from)
);
CREATE INDEX idx_instruments_lookup ON instruments(symbol, instrument_type, is_active, valid_from, valid_to);
CREATE INDEX idx_instruments_groww_token ON instruments(groww_token);

-- ============================================
-- GROWW CREDENTIALS (Encrypted via envelope encryption)
-- ============================================
CREATE TABLE groww_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES "user"(id) ON DELETE CASCADE UNIQUE,
    -- Envelope encrypted: DEK encrypted with KEK from keychain
    api_key_encrypted BYTEA NOT NULL,
    api_secret_encrypted BYTEA NOT NULL,
    totp_secret_encrypted BYTEA NOT NULL,
    access_token_encrypted BYTEA,
    refresh_token_encrypted BYTEA,
    token_expires_at TIMESTAMPTZ,
    last_refresh_at TIMESTAMPTZ,
    refresh_count_today INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MARKET DATA: 1-Minute Candles (Raw)
-- ============================================
CREATE TABLE candles_1m (
    id BIGSERIAL PRIMARY KEY,
    instrument_id BIGINT REFERENCES instruments(id) ON DELETE CASCADE,
    bar_time TIMESTAMPTZ NOT NULL,         -- Bar OPEN time (aligned)
    open NUMERIC(12,4) NOT NULL,
    high NUMERIC(12,4) NOT NULL,
    low NUMERIC(12,4) NOT NULL,
    close NUMERIC(12,4) NOT NULL,
    volume BIGINT NOT NULL,
    oi BIGINT,                             -- Open Interest
    bid NUMERIC(12,4),                     -- For paper fill simulation
    ask NUMERIC(12,4),
    source VARCHAR(20) DEFAULT 'groww',    -- groww, reconstructed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(instrument_id, bar_time)
);
CREATE INDEX idx_candles_1m_inst_time ON candles_1m(instrument_id, bar_time DESC);
CREATE INDEX idx_candles_1m_time_only ON candles_1m(bar_time DESC);

-- ============================================
-- RESAMPLED CANDLES (Raw OHLCV only - indicators computed on read)
-- ============================================
CREATE TABLE candles_resampled (
    id BIGSERIAL PRIMARY KEY,
    instrument_id BIGINT REFERENCES instruments(id) ON DELETE CASCADE,
    timeframe VARCHAR(10) NOT NULL,        -- 5m, 15m, 30m
    bar_time TIMESTAMPTZ NOT NULL,         -- Aligned to 09:15
    open NUMERIC(12,4) NOT NULL,
    high NUMERIC(12,4) NOT NULL,
    low NUMERIC(12,4) NOT NULL,
    close NUMERIC(12,4) NOT NULL,
    volume BIGINT NOT NULL,
    oi BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(instrument_id, timeframe, bar_time)
);
CREATE INDEX idx_candles_resampled_lookup ON candles_resampled(instrument_id, timeframe, bar_time DESC);

-- ============================================
-- STRATEGIES
-- ============================================
CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    underlying_symbol VARCHAR(50) NOT NULL,    -- NIFTY, BANKNIFTY
    timeframe VARCHAR(10) NOT NULL,            -- 5m, 15m, 30m
    entry_start_time TIME NOT NULL,            -- HH:mm format
    entry_end_time TIME NOT NULL,              -- HH:mm format
    exit_time TIME NOT NULL DEFAULT '15:00:00',
    execution_mode VARCHAR(20) NOT NULL,       -- DEEP_ITM_BUY, ATM_BUY, ATM_SELL
    strike_offset INTEGER DEFAULT 5,           -- Strikes from ATM (5 = 250 pts NIFTY)
    lots INTEGER NOT NULL DEFAULT 1,
    risk_params JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SIGNALS (Audit trail for every signal generated)
-- ============================================
CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    run_type VARCHAR(20) NOT NULL,       -- backtest, paper, live
    bar_time TIMESTAMPTZ NOT NULL,       -- Signal bar close time
    signal_type VARCHAR(10) NOT NULL,    -- BUY, SELL
    ema_9 NUMERIC(12,4) NOT NULL,
    ema_21 NUMERIC(12,4) NOT NULL,
    spot_price NUMERIC(12,2) NOT NULL,
    selected_strike NUMERIC(12,2),
    option_type VARCHAR(10),             -- CE, PE
    option_symbol VARCHAR(100),
    entry_window_valid BOOLEAN NOT NULL,
    reversal_signal BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_signals_strategy_time ON signals(strategy_id, bar_time DESC);
CREATE INDEX idx_signals_run_type ON signals(run_type, bar_time DESC);

-- ============================================
-- BACKTEST RUNS
-- ============================================
CREATE TABLE backtest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    name VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_capital NUMERIC(15,2) NOT NULL,
    final_capital NUMERIC(15,2),
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    max_drawdown NUMERIC(10,2),
    sharpe_ratio NUMERIC(10,4),
    sortino_ratio NUMERIC(10,4),
    calmar_ratio NUMERIC(10,4),
    profit_factor NUMERIC(10,4),
    win_rate NUMERIC(5,2),
    avg_win NUMERIC(12,2),
    avg_loss NUMERIC(12,2),
    max_consecutive_wins INTEGER,
    max_consecutive_losses INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    config_snapshot JSONB NOT NULL,        -- Full strategy config at run time
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BACKTEST TRADES (Separate from live/paper)
-- ============================================
CREATE TABLE backtest_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backtest_run_id UUID REFERENCES backtest_runs(id) ON DELETE CASCADE,
    signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
    trade_num INTEGER NOT NULL,            -- Sequential within run
    symbol VARCHAR(50) NOT NULL,
    option_symbol VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL,             -- LONG, SHORT
    entry_time TIMESTAMPTZ NOT NULL,
    entry_price NUMERIC(12,4) NOT NULL,
    exit_time TIMESTAMPTZ,
    exit_price NUMERIC(12,4),
    quantity INTEGER NOT NULL,             -- lots * lot_size
    gross_pnl NUMERIC(12,2),
    costs NUMERIC(12,2),
    net_pnl NUMERIC(12,2),
    exit_reason VARCHAR(50),               -- OPPOSITE_CROSSOVER, SQUARE_OFF, REVERSAL
    metadata JSONB DEFAULT '{}',           -- IV, greeks, slippage detail
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_backtest_trades_run ON backtest_trades(backtest_run_id, entry_time);

-- ============================================
-- PAPER TRADING
-- ============================================
CREATE TABLE paper_portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES "user"(id) ON DELETE CASCADE UNIQUE,
    cash_balance NUMERIC(15,2) NOT NULL DEFAULT 1000000,
    total_value NUMERIC(15,2) NOT NULL DEFAULT 1000000,
    daily_pnl NUMERIC(15,2) DEFAULT 0,
    day_start_value NUMERIC(15,2) DEFAULT 1000000,
    max_daily_loss NUMERIC(15,2) GENERATED ALWAYS AS (total_value * 0.02) STORED,
    is_active BOOLEAN DEFAULT TRUE,
    session_started_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE paper_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES paper_portfolios(id) ON DELETE CASCADE,
    option_symbol VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL,             -- LONG, SHORT
    quantity INTEGER NOT NULL,
    avg_entry_price NUMERIC(12,4) NOT NULL,
    current_price NUMERIC(12,4),
    unrealized_pnl NUMERIC(12,2) DEFAULT 0,
    realized_pnl NUMERIC(12,2) DEFAULT 0,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    -- Partial index: only one OPEN position per symbol per portfolio
    UNIQUE(portfolio_id, option_symbol)
    WHERE closed_at IS NULL
);

CREATE TABLE paper_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES paper_portfolios(id) ON DELETE CASCADE,
    signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
    option_symbol VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL,             -- BUY, SELL
    entry_time TIMESTAMPTZ NOT NULL,
    entry_price NUMERIC(12,4) NOT NULL,    -- Filled at ask (buy) / bid (sell)
    exit_time TIMESTAMPTZ,
    exit_price NUMERIC(12,4),
    quantity INTEGER NOT NULL,
    gross_pnl NUMERIC(12,2),
    costs NUMERIC(12,2),
    net_pnl NUMERIC(12,2),
    exit_reason VARCHAR(50),
    fill_metadata JSONB DEFAULT '{}',      -- bid, ask, spread at fill
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_paper_trades_portfolio ON paper_trades(portfolio_id, entry_time DESC);

-- ============================================
-- LIVE TRADING (Audit-critical)
-- ============================================
CREATE TABLE live_fills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
    signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
    groww_order_id VARCHAR(100),
    idempotency_key UUID NOT NULL UNIQUE,  -- Client-generated before order
    symbol VARCHAR(50) NOT NULL,
    option_symbol VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL,             -- BUY, SELL
    order_type VARCHAR(20) NOT NULL,       -- MARKET, LIMIT
    quantity INTEGER NOT NULL,
    limit_price NUMERIC(12,4),
    trigger_price NUMERIC(12,4),
    status VARCHAR(30) NOT NULL,           -- PENDING, OPEN, COMPLETE, CANCELLED, REJECTED
    filled_quantity INTEGER DEFAULT 0,
    avg_fill_price NUMERIC(12,4),
    placed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_live_fills_user_time ON live_fills(user_id, placed_at DESC);
CREATE INDEX idx_live_fills_groww_order ON live_fills(groww_order_id);
CREATE INDEX idx_live_fills_idempotency ON live_fills(idempotency_key);

CREATE TABLE live_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    option_symbol VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL,             -- LONG, SHORT
    quantity INTEGER NOT NULL,
    avg_entry_price NUMERIC(12,4) NOT NULL,
    current_price NUMERIC(12,4),
    unrealized_pnl NUMERIC(12,2) DEFAULT 0,
    realized_pnl NUMERIC(12,2) DEFAULT 0,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    UNIQUE(user_id, option_symbol) WHERE closed_at IS NULL
);

-- ============================================
-- AUDIT LOGS (Immutable - enforced by RLS)
-- ============================================
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user_time ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- RLS Policy: No UPDATE/DELETE on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_immutable ON audit_logs FOR ALL USING (false) WITH CHECK (false);
-- App role gets INSERT only via GRANT INSERT ON audit_logs TO app_role;

-- ============================================
-- MARKET DATA CACHE
-- ============================================
CREATE TABLE market_data_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_market_cache_expires ON market_data_cache(expires_at);

-- ============================================
-- RECONCILIATION STATE (For crash recovery)
-- ============================================
CREATE TABLE reconciliation_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    run_type VARCHAR(20) NOT NULL,       -- paper, live
    last_processed_bar TIMESTAMPTZ,      -- Last 1m bar processed
    open_signals JSONB DEFAULT '[]',     -- Signals generated but not yet acted on
    open_positions_snapshot JSONB,       -- Groww positions at last sync
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, run_type)
);
```

---

## Strategy Core Module Spec

### File Structure
```
packages/strategy-core/
├── src/
│   ├── types.ts                    # All TypeScript interfaces
│   ├── indicators/
│   │   ├── ema.ts                  # EMA with proper seeding
│   │   ├── crossover.ts            # Crossover detection
│   │   └── resample.ts             # 1m → 5m/15m/30m aligned to 09:15
│   ├── signals/
│   │   ├── generator.ts            # Signal from candles + config
│   │   ├── filters.ts              # Entry window, time filters
│   │   └── reversal.ts             # Immediate reversal logic
│   ├── execution/
│   │   ├── instrument-resolver.ts  # Strike selection from instrument master
│   │   ├── position-sizer.ts       # Lot sizing
│   │   └── cost-calculator.ts      # Brokerage, STT, slippage (dated config)
│   ├── backtest/
│   │   ├── engine.ts               # Event-driven backtest
│   │   ├── metrics.ts              # Performance metrics
│   │   └── reporter.ts             # Result formatting
│   └── index.ts                    # Public exports
├── test/
│   ├── ema.test.ts
│   ├── resample.test.ts
│   ├── crossover.test.ts
│   ├── generator.test.ts
│   └── backtest.test.ts
├── package.json
└── tsconfig.json
```

### Key Interfaces (types.ts)

```typescript
// Timeframe aligned to 09:15 IST
type Timeframe = '5m' | '15m' | '30m';
type ExecutionMode = 'DEEP_ITM_BUY' | 'ATM_BUY' | 'ATM_SELL';
type SignalType = 'BUY' | 'SELL';
type TradeSide = 'LONG' | 'SHORT';
type OrderSide = 'BUY' | 'SELL';
type ExitReason = 'OPPOSITE_CROSSOVER' | 'SQUARE_OFF' | 'REVERSAL' | 'MANUAL' | 'RISK_LIMIT';
type RunType = 'backtest' | 'paper' | 'live';

// Instrument from master table
interface Instrument {
  id: number;
  symbol: string;
  instrumentType: 'INDEX' | 'FUT' | 'OPT';
  lotSize: number;
  tickSize: number;
  strikeStep: number;
  underlyingSymbol?: string;
  strikePrice?: number;
  optionType?: 'CE' | 'PE';
  expiryDate?: Date;
  validFrom: Date;
  validTo: Date | null;
  growwToken: string;
}

// 1-minute candle (raw)
interface Candle1m {
  instrumentId: number;
  barTime: Date;           // Bar OPEN time
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
  bid?: number;
  ask?: number;
}

// Resampled candle (raw OHLCV only)
interface CandleResampled {
  instrumentId: number;
  timeframe: Timeframe;
  barTime: Date;           // Aligned to 09:15
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

// Strategy Configuration (validated by Zod)
interface StrategyConfig {
  id?: string;
  name: string;
  underlyingSymbol: 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY';
  timeframe: Timeframe;
  entryWindow: {
    start: string;  // HH:mm format, e.g., "09:30"
    end: string;    // HH:mm format, e.g., "11:30"
  };
  exitTime: string; // "15:00"
  executionMode: ExecutionMode;
  strikeOffset: number;     // Strikes from ATM (5 = 250 pts for NIFTY)
  lots: number;
  risk: {
    maxDailyLossPct: number;
    maxPositions: number;
    perTradeRiskPct: number;
    blockedPeriods: string[];  // ["09:15-09:30", "15:15-15:30"]
  };
  costs: CostConfig;
}

// Cost Configuration (dated - changes over time)
interface CostConfig {
  effectiveFrom: string;  // ISO date
  brokeragePerOrder: number;    // 20
  sttPct: number;               // 0.0005 (sell side premium)
  exchangePct: number;          // 0.00053
  gstPct: number;               // 0.18
  sebiPerCrore: number;         // 10
  stampPct: number;             // 0.00003 (buy side)
  slippageTicks: number;        // 1 tick = 0.05
}

// Signal with full context for audit
interface Signal {
  strategyId: string;
  runType: RunType;
  barTime: Date;              // Signal bar CLOSE time
  signalType: SignalType;     // BUY or SELL
  ema9: number;
  ema21: number;
  spotPrice: number;
  selectedStrike: number;
  optionType: 'CE' | 'PE';
  optionSymbol: string;
  entryWindowValid: boolean;
  isReversal: boolean;
  metadata: Record<string, unknown>;
}

// Trade (backtest/paper/live share structure)
interface TradeBase {
  signalId?: string;
  optionSymbol: string;
  side: TradeSide;            // LONG or SHORT
  entryTime: Date;
  entryPrice: number;         // Fill price
  exitTime?: Date;
  exitPrice?: number;
  quantity: number;           // lots * lotSize
  grossPnl?: number;
  costs?: number;
  netPnl?: number;
  exitReason?: ExitReason;
  metadata: Record<string, unknown>;
}

// Position
interface Position {
  optionSymbol: string;
  side: TradeSide;
  quantity: number;
  avgEntryPrice: number;
  currentPrice?: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

// Portfolio State
interface PortfolioState {
  cashBalance: number;
  totalValue: number;
  dailyPnl: number;
  positions: Position[];
}
```

### EMA Implementation (ema.ts)

```typescript
/**
 * EMA with proper seeding for broker compatibility
 * 
 * Seeding: First EMA = SMA of first `period` closes
 * Warm-up: First `period - 1` values are NaN (not usable for signals)
 * Continuity: EMAs run continuously across sessions (no daily reset)
 */
export function calculateEMA(prices: number[], period: number): (number | NaN)[] {
  if (prices.length < period) {
    return prices.map(() => NaN);
  }
  
  const multiplier = 2 / (period + 1);
  const ema: (number | NaN)[] = new Array(prices.length).fill(NaN);
  
  // Seed with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  ema[period - 1] = sum / period;
  
  // Calculate rest
  for (let i = period; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i - 1]!) * multiplier + ema[i - 1]!;
  }
  
  return ema;
}

/**
 * Calculate EMA incrementally for streaming
 * Use when adding one bar at a time (live/paper)
 */
export function updateEMA(
  prevEMA: number, 
  currentPrice: number, 
  period: number
): number {
  const multiplier = 2 / (period + 1);
  return (currentPrice - prevEMA) * multiplier + prevEMA;
}

/**
 * Calculate initial EMA from historical closes (for warm-up)
 * Returns { ema9, ema21, warmupComplete: boolean }
 */
export function initializeEMAs(
  closes: number[]
): { ema9: number | NaN; ema21: number | NaN; warmupComplete: boolean } {
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  
  const lastIdx = closes.length - 1;
  return {
    ema9: ema9[lastIdx],
    ema21: ema21[lastIdx],
    warmupComplete: !isNaN(ema21[lastIdx])  // 21 is longer
  };
}
```

### Resampling (resample.ts)

```typescript
/**
 * Resample 1m candles to target timeframe aligned to 09:15 IST
 * 
 * Alignment:
 *   5m:  09:15, 09:20, 09:25, ...
 *   15m: 09:15, 09:30, 09:45, ...
 *   30m: 09:15, 09:45, 10:15, ...
 */
export function resampleCandles(
  candles: Candle1m[],
  timeframe: Timeframe,
  marketOpen: string = '09:15'
): CandleResampled[] {
  const minutes = timeframeToMinutes(timeframe);
  const [openHour, openMin] = marketOpen.split(':').map(Number);
  
  // Group candles by aligned timeframe boundary
  const groups = new Map<number, Candle1m[]>();
  
  for (const candle of candles) {
    const barTime = getAlignedBarTime(candle.barTime, minutes, openHour, openMin);
    const key = barTime.getTime();
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(candle);
  }
  
  // Build resampled candles
  const result: CandleResampled[] = [];
  
  for (const [key, group] of groups) {
    if (group.length === 0) continue;
    
    // Sort by time
    group.sort((a, b) => a.barTime.getTime() - b.barTime.getTime());
    
    const open = group[0].open;
    const high = Math.max(...group.map(c => c.high));
    const low = Math.min(...group.map(c => c.low));
    const close = group[group.length - 1].close;
    const volume = group.reduce((sum, c) => sum + c.volume, 0);
    const oi = group[group.length - 1].oi;
    
    result.push({
      instrumentId: group[0].instrumentId,
      timeframe,
      barTime: new Date(key),
      open, high, low, close, volume, oi
    });
  }
  
  // Sort by time
  result.sort((a, b) => a.barTime.getTime() - b.barTime.getTime());
  
  return result;
}

function timeframeToMinutes(tf: Timeframe): number {
  return { '5m': 5, '15m': 15, '30m': 30 }[tf];
}

function getAlignedBarTime(
  timestamp: Date, 
  minutes: number, 
  openHour: number, 
  openMin: number
): Date {
  const ts = new Date(timestamp);
  const totalMinutes = (ts.getHours() - openHour) * 60 + (ts.getMinutes() - openMin);
  
  if (totalMinutes < 0) {
    // Before market open - shouldn't happen but handle
    return new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), openHour, openMin);
  }
  
  const alignedIndex = Math.floor(totalMinutes / minutes);
  const alignedMinutes = alignedIndex * minutes;
  
  return new Date(
    ts.getFullYear(), 
    ts.getMonth(), 
    ts.getDate(), 
    openHour, 
    openMin + alignedMinutes
  );
}
```

### Crossover Detection (crossover.ts)

```typescript
export type CrossoverDirection = 'BULLISH' | 'BEARISH' | 'NONE';

/**
 * Detect crossover on CLOSED bars only
 * Returns crossover at index i if bars[i-1] and bars[i] show crossover
 */
export function detectCrossover(
  ema9: (number | NaN)[],
  ema21: (number | NaN)[]
): CrossoverDirection[] {
  const result: CrossoverDirection[] = new Array(ema9.length).fill('NONE');
  
  for (let i = 1; i < ema9.length; i++) {
    const prev9 = ema9[i - 1];
    const prev21 = ema21[i - 1];
    const curr9 = ema9[i];
    const curr21 = ema21[i];
    
    // Skip if any value is NaN (warm-up period)
    if (isNaN(prev9) || isNaN(prev21) || isNaN(curr9) || isNaN(curr21)) {
      continue;
    }
    
    // Bullish: EMA9 crosses ABOVE EMA21
    if (prev9 <= prev21 && curr9 > curr21) {
      result[i] = 'BULLISH';
    }
    // Bearish: EMA9 crosses BELOW EMA21
    else if (prev9 >= prev21 && curr9 < curr21) {
      result[i] = 'BEARISH';
    }
  }
  
  return result;
}

/**
 * Check if time is within entry window
 */
export function isInEntryWindow(
  time: Date,
  windowStart: string,  // "HH:mm"
  windowEnd: string,
  blockedPeriods: string[] = []
): boolean {
  const minutes = time.getHours() * 60 + time.getMinutes();
  
  const [startH, startM] = windowStart.split(':').map(Number);
  const [endH, endM] = windowEnd.split(':').map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  
  if (minutes < startMin || minutes > endMin) {
    return false;
  }
  
  // Check blocked periods
  for (const period of blockedPeriods) {
    const [blockStart, blockEnd] = period.split('-');
    const [bsH, bsM] = blockStart.split(':').map(Number);
    const [beH, beM] = blockEnd.split(':').map(Number);
    const blockStartMin = bsH * 60 + bsM;
    const blockEndMin = beH * 60 + beM;
    
    if (minutes >= blockStartMin && minutes <= blockEndMin) {
      return false;
    }
  }
  
  return true;
}
```

### Signal Generator (generator.ts)

```typescript
export function generateSignals(
  resampledCandles: CandleResampled[],
  spotCandles: CandleResampled[],      // Index candles for EMA
  config: StrategyConfig,
  instruments: Instrument[],
  runType: RunType
): Signal[] {
  // 1. Calculate EMAs on spot (index) candles
  const spotCloses = spotCandles.map(c => c.close);
  const ema9 = calculateEMA(spotCloses, 9);
  const ema21 = calculateEMA(spotCloses, 21);
  
  // 2. Detect crossovers
  const crossovers = detectCrossover(ema9, ema21);
  
  // 3. Generate signals
  const signals: Signal[] = [];
  let currentPosition: TradeSide | null = null;
  
  for (let i = 0; i < crossovers.length; i++) {
    const crossover = crossovers[i];
    if (crossover === 'NONE') continue;
    
    const barTime = spotCandles[i].barTime;
    const spotPrice = spotCandles[i].close;
    const currentEMA9 = ema9[i];
    const currentEMA21 = ema21[i];
    
    // Determine signal type
    const signalType: SignalType = crossover === 'BULLISH' ? 'BUY' : 'SELL';
    const newPosition: TradeSide = signalType === 'BUY' ? 'LONG' : 'SHORT';
    
    // Check entry window
    const entryWindowValid = isInEntryWindow(
      barTime,
      config.entryWindow.start,
      config.entryWindow.end,
      config.risk.blockedPeriods
    );
    
    // Check for immediate reversal
    const isReversal = currentPosition !== null && currentPosition !== newPosition;
    
    // Reversal only allowed if new signal is in entry window
    if (isReversal && !entryWindowValid) {
      continue; // Ignore reversal outside window
    }
    
    // Select strike
    const { strike, optionType, optionSymbol } = selectStrike(
      spotPrice,
      signalType,
      config.executionMode,
      config.strikeOffset,
      instruments
    );
    
    signals.push({
      strategyId: config.id!,
      runType,
      barTime,
      signalType,
      ema9: currentEMA9,
      ema21: currentEMA21,
      spotPrice,
      selectedStrike: strike,
      optionType,
      optionSymbol,
      entryWindowValid,
      isReversal,
      metadata: {
        currentPosition,
        crossoverIndex: i
      }
    });
    
    // Update position state
    if (entryWindowValid) {
      currentPosition = isReversal ? newPosition : newPosition;
    }
  }
  
  return signals;
}

function selectStrike(
  spotPrice: number,
  signalType: SignalType,
  mode: ExecutionMode,
  strikeOffset: number,
  instruments: Instrument[]
): { strike: number; optionType: 'CE' | 'PE'; optionSymbol: string } {
  // Find index instrument
  const indexInst = instruments.find(i => i.symbol === 'NIFTY' && i.instrumentType === 'INDEX');
  const step = indexInst?.strikeStep || 50;
  
  // ATM = nearest strike
  const atm = Math.round(spotPrice / step) * step;
  
  let strike: number;
  let optionType: 'CE' | 'PE';
  
  if (signalType === 'BUY') {
    optionType = 'CE';
    if (mode === 'DEEP_ITM_BUY') {
      strike = atm - (strikeOffset * step);  // ITM Call
    } else {
      strike = atm;  // ATM
    }
  } else { // SELL
    if (mode === 'ATM_SELL') {
      optionType = 'CE';  // Sell ATM Call (or could be Put)
      strike = atm;
    } else {
      optionType = 'PE';
      if (mode === 'DEEP_ITM_BUY') {
        strike = atm + (strikeOffset * step);  // ITM Put
      } else {
        strike = atm;  // ATM Put
      }
    }
  }
  
  // Find matching instrument
  const optionInst = instruments.find(i => 
    i.underlyingSymbol === 'NIFTY' &&
    i.instrumentType === 'OPT' &&
    i.strikePrice === strike &&
    i.optionType === optionType &&
    i.isActive &&
    new Date() >= i.validFrom &&
    (!i.validTo || new Date() <= i.validTo)
  );
  
  const optionSymbol = optionInst?.growwToken || `NIFTY${formatExpiry(optionInst?.expiryDate)}${strike}${optionType}`;
  
  return { strike, optionType, optionSymbol };
}

function formatExpiry(date?: Date): string {
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase();
}
```

---

## Phase 1 Implementation Tasks

### Task 1: Project Setup
- [ ] Initialize Bun monorepo with workspaces
- [ ] Configure TypeScript strict mode
- [ ] Set up ESLint + Prettier + Husky
- [ ] Create `.env.example` with all variables
- [ ] Set up Neon PostgreSQL connection
- [ ] Configure Better Auth

### Task 2: Database & Migrations
- [ ] Create migration files for schema above
- [ ] Set up Drizzle ORM (type-safe, works with Bun)
- [ ] Create seed script for instruments (NIFTY lot sizes over time)
- [ ] Set up encryption utilities (envelope encryption)

### Task 3: Strategy Core Package
- [ ] Create `packages/strategy-core` with types
- [ ] Implement EMA, resample, crossover modules
- [ ] Implement signal generator
- [ ] Write comprehensive tests (Jest/Vitest via Bun)

### Task 4: Groww API Client
- [ ] TOTP authentication flow
- [ ] Token refresh with encryption
- [ ] Historical data downloader (1m candles)
- [ ] Instrument master sync
- [ ] WebSocket market data client

### Task 5: API Foundation (Elysia)
- [ ] Auth routes (Better Auth integration)
- [ ] Health check
- [ ] WebSocket infrastructure
- [ ] Rate limiting
- [ ] Audit logging middleware

### Task 6: Frontend Foundation (React + Vite)
- [ ] Project setup with TypeScript
- [ ] Tailwind + shadcn/ui
- [ ] TanStack Query setup
- [ ] Zustand stores
- [ ] Routing (React Router)
- [ ] Layout components

---

## Environment Variables (`.env.example`)

```bash
# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:3000

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/trading?sslmode=require
DATABASE_POOL_SIZE=10

# Better Auth
BETTER_AUTH_SECRET=your-32-char-secret-here
BETTER_AUTH_URL=http://localhost:3000

# Encryption (Envelope encryption - KEK from OS keychain)
# On macOS: security add-generic-password -a "trading-app" -s "master-key" -w "$(openssl rand -hex 32)"
# On Linux: secret-tool store --label="trading-master-key" app trading-app
# Or set directly for dev:
ENCRYPTION_MASTER_KEY=your-32-byte-hex-key-for-dev-only

# Groww API
GROWW_API_KEY=your-groww-api-key
GROWW_API_SECRET=your-groww-api-secret
GROWW_TOTP_SECRET=your-totp-secret-from-keys.txt
GROWW_REDIRECT_URI=http://localhost:3000/api/auth/groww/callback

# Market Hours
MARKET_OPEN=09:15
MARKET_CLOSE=15:30
TIMEZONE=Asia/Kolkata

# Default Risk Limits (user can override)
DEFAULT_MAX_DAILY_LOSS_PCT=2
DEFAULT_MAX_POSITIONS=3
DEFAULT_PER_TRADE_RISK_PCT=1
DEFAULT_PAPER_CAPITAL=1000000

# Feature Flags
ENABLE_LIVE_TRADING=false
ENABLE_PAPER_TRADING=true
ENABLE_BACKTEST=true

# Cost Config (dated - update when broker changes)
COST_CONFIG_EFFECTIVE_FROM=2024-01-01
COST_BROKERAGE_PER_ORDER=20
COST_STT_PCT=0.0005
COST_EXCHANGE_PCT=0.00053
COST_GST_PCT=0.18
COST_SEBI_PER_CRORE=10
COST_STAMP_PCT=0.00003
COST_SLIPPAGE_TICKS=1
```

---

## Acceptance Criteria for Phase 1

| Criterion | Verification |
|-----------|--------------|
| Bun monorepo builds | `bun run build` succeeds |
| Tests pass | `bun test` > 90% coverage on strategy-core |
| DB migrations run | `bun run db:migrate` creates all tables |
| Better Auth works | Register → Login → 2FA flow works |
| Groww auth works | Can fetch profile/funds with TOTP |
| EMA matches TradingView | Compare 9/21 EMA on same data |
| Resampling aligns to 09:15 | Verify bar boundaries |
| Crossover on closed bars | No look-ahead bias |
| Strike selection correct | Deep ITM = ATM - 5 strikes |
| Paper fills at bid/ask | Verify fill logic |

---

*Phase 1 Spec v1.1 (incorporating review feedback)*
*2026-11-24*