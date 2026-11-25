# System Architecture

## High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐  │
│  │ Dashboard  │ │ Strategy   │ │  Backtest  │ │ Trade      │ │ Paper/    │  │
│  │ Overview   │ │ Builder    │ │  Results   │ │ Auditor    │ │ Live      │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └───────────┘  │
└──────────────────────────────────┬────────────────────────────────────────────┘
                                   │ HTTPS / WSS
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API GATEWAY (Elysia)                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐  │
│  │   Auth     │ │ Strategies │ │  Backtest  │ │   Trades   │ │  Market   │  │
│  │  Routes    │ │  Routes    │ │  Routes    │ │  Routes    │ │  Data     │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └───────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐  │
│  │   Paper    │ │   Live     │ │  Screener  │ │  WebSocket │ │  Health   │  │
│  │  Trading   │ │  Trading   │ │  Routes    │ │  Manager   │ │  Check    │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └───────────┘  │
└──────────────────────────────────┬────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
┌───────────────┐         ┌─────────────────┐         ┌───────────────┐
│  PostgreSQL   │         │   Groww API     │         │  Strategy     │
│  (Neon)       │         │   Client        │         │  Engine       │
│               │         │                 │         │               │
│  • users      │         │  • REST API     │         │  • Indicators │
│  • strategies │         │  • WebSocket    │         │  • Signals    │
│  • candles    │         │  • Auth (TOTP)  │         │  • Execution  │
│  • trades     │         │  • Orders       │         │  • Backtest   │
│  • positions  │         │  • Portfolio    │         │  • Risk Mgmt  │
│  • audit_logs │         └─────────────────┘         └───────────────┘
└───────────────┘
```

---

## Data Flow

### 1. Historical Data Ingestion
```
Groww API (1m candles) → Validate/Transform → PostgreSQL (candles_1m)
                                                      ↓
                              Resample (5m/15m/30m) → PostgreSQL (candles_resampled)
```

### 2. Backtest Execution
```
User Config → Strategy Engine → Load Candles → Generate Signals
                                                      ↓
                              Apply Entry Window Filter → Simulate Trades
                                                      ↓
                              Calculate Metrics → Store Results → Return to UI
```

### 3. Live Signal Generation
```
WebSocket (1m ticks) → Aggregate to timeframe → Update EMAs
                                                      ↓
                              Check Crossover → Validate Entry Window
                                                      ↓
                              Generate Signal → Risk Check → Execute (Paper/Live)
```

### 4. Trade Audit
```
Trade ID → Load 1m candles (±30 min) → Load resampled candles
                                                      ↓
                              Calculate EMAs on timeframe → Render Chart
                                                      ↓
                              Overlay Entry/Exit markers → Display
```

---

## Database Schema (PostgreSQL)

### Core Tables

```sql
-- Better Auth Tables (managed by Better Auth)
-- user, session, account, verification, passkey

-- User Profiles (extends Better Auth user)
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

-- Instrument Master (Critical for lot sizes)
CREATE TABLE instruments (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    instrument_type VARCHAR(20) NOT NULL,
    name VARCHAR(200),
    exchange VARCHAR(20) DEFAULT 'NSE',
    segment VARCHAR(20) DEFAULT 'FO',
    lot_size INTEGER NOT NULL,
    tick_size DECIMAL(10,4) NOT NULL DEFAULT 0.05,
    strike_step INTEGER,
    underlying_symbol VARCHAR(50),
    strike_price DECIMAL(12,2),
    option_type VARCHAR(10),
    expiry_date DATE,
    expiry_type VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    valid_from DATE NOT NULL,
    valid_to DATE,
    groww_token VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, instrument_type, expiry_date, strike_price, option_type, valid_from)
);
CREATE INDEX idx_instruments_lookup ON instruments(symbol, instrument_type, is_active, valid_from, valid_to);

-- Groww Credentials (Envelope encrypted)
CREATE TABLE groww_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES "user"(id) ON DELETE CASCADE UNIQUE,
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

-- 1-minute Candles (raw from Groww)
CREATE TABLE candles_1m (
    id BIGSERIAL PRIMARY KEY,
    instrument_id BIGINT REFERENCES instruments(id) ON DELETE CASCADE,
    bar_time TIMESTAMPTZ NOT NULL,
    open NUMERIC(12,4) NOT NULL,
    high NUMERIC(12,4) NOT NULL,
    low NUMERIC(12,4) NOT NULL,
    close NUMERIC(12,4) NOT NULL,
    volume BIGINT NOT NULL,
    oi BIGINT,
    bid NUMERIC(12,4),
    ask NUMERIC(12,4),
    source VARCHAR(20) DEFAULT 'groww',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(instrument_id, bar_time)
);
CREATE INDEX idx_candles_1m_inst_time ON candles_1m(instrument_id, bar_time DESC);

-- Resampled Candles (5m, 15m, 30m aligned to 09:15)
CREATE TABLE candles_resampled (
    id BIGSERIAL PRIMARY KEY,
    instrument_id BIGINT REFERENCES instruments(id) ON DELETE CASCADE,
    timeframe VARCHAR(10) NOT NULL,
    bar_time TIMESTAMPTZ NOT NULL,
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

-- Strategies
CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    underlying_symbol VARCHAR(50) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    entry_start_time TIME NOT NULL,
    entry_end_time TIME NOT NULL,
    exit_time TIME NOT NULL DEFAULT '15:00:00',
    execution_mode VARCHAR(20) NOT NULL,
    strike_offset INTEGER DEFAULT 5,
    lots INTEGER NOT NULL DEFAULT 1,
    risk_params JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signals (Audit trail for every signal)
CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    run_type VARCHAR(20) NOT NULL,
    bar_time TIMESTAMPTZ NOT NULL,
    signal_type VARCHAR(10) NOT NULL,
    ema_9 NUMERIC(12,4) NOT NULL,
    ema_21 NUMERIC(12,4) NOT NULL,
    spot_price NUMERIC(12,2) NOT NULL,
    selected_strike NUMERIC(12,2),
    option_type VARCHAR(10),
    option_symbol VARCHAR(100),
    expiry_date DATE,
    entry_window_valid BOOLEAN NOT NULL,
    reversal_signal BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_signals_strategy_time ON signals(strategy_id, bar_time DESC);

-- Backtest Runs
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
    profit_factor NUMERIC(10,4),
    win_rate NUMERIC(5,2),
    avg_win NUMERIC(12,2),
    avg_loss NUMERIC(12,2),
    max_consecutive_wins INTEGER,
    max_consecutive_losses INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    config_snapshot JSONB NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backtest Trades (Separate from live/paper)
CREATE TABLE backtest_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backtest_run_id UUID REFERENCES backtest_runs(id) ON DELETE CASCADE,
    signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
    trade_num INTEGER NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    option_symbol VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL,
    entry_time TIMESTAMPTZ NOT NULL,
    entry_price NUMERIC(12,4) NOT NULL,
    exit_time TIMESTAMPTZ,
    exit_price NUMERIC(12,4),
    quantity INTEGER NOT NULL,
    gross_pnl NUMERIC(12,2),
    costs NUMERIC(12,2),
    net_pnl NUMERIC(12,2),
    exit_reason VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_backtest_trades_run ON backtest_trades(backtest_run_id, entry_time);

-- Paper Trading
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
    side VARCHAR(10) NOT NULL,
    quantity INTEGER NOT NULL,
    avg_entry_price NUMERIC(12,4) NOT NULL,
    current_price NUMERIC(12,4),
    unrealized_pnl NUMERIC(12,2) DEFAULT 0,
    realized_pnl NUMERIC(12,2) DEFAULT 0,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    UNIQUE(portfolio_id, option_symbol) WHERE closed_at IS NULL
);

CREATE TABLE paper_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES paper_portfolios(id) ON DELETE CASCADE,
    signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
    option_symbol VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL,
    entry_time TIMESTAMPTZ NOT NULL,
    entry_price NUMERIC(12,4) NOT NULL,
    exit_time TIMESTAMPTZ,
    exit_price NUMERIC(12,4),
    quantity INTEGER NOT NULL,
    gross_pnl NUMERIC(12,2),
    costs NUMERIC(12,2),
    net_pnl NUMERIC(12,2),
    exit_reason VARCHAR(50),
    fill_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_paper_trades_portfolio ON paper_trades(portfolio_id, entry_time DESC);

-- Live Trading (Audit-critical)
CREATE TABLE live_fills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
    signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
    groww_order_id VARCHAR(100),
    idempotency_key UUID NOT NULL UNIQUE,
    symbol VARCHAR(50) NOT NULL,
    option_symbol VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC(12,4),
    trigger_price NUMERIC(12,4),
    status VARCHAR(30) NOT NULL,
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
    side VARCHAR(10) NOT NULL,
    quantity INTEGER NOT NULL,
    avg_entry_price NUMERIC(12,4) NOT NULL,
    current_price NUMERIC(12,4),
    unrealized_pnl NUMERIC(12,2) DEFAULT 0,
    realized_pnl NUMERIC(12,2) DEFAULT 0,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    UNIQUE(user_id, option_symbol) WHERE closed_at IS NULL
);

-- Audit Logs (Immutable - enforced by RLS)
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

-- Market Data Cache
CREATE TABLE market_data_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_market_data_cache_expires ON market_data_cache(expires_at);

-- Reconciliation State (For crash recovery)
CREATE TABLE reconciliation_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    run_type VARCHAR(20) NOT NULL,
    last_processed_bar TIMESTAMPTZ,
    open_signals JSONB DEFAULT '[]',
    open_positions_snapshot JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, run_type)
);
```

---

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/2fa/enable` | Enable 2FA |
| POST | `/api/auth/2fa/verify` | Verify 2FA code |
| GET | `/api/auth/me` | Get current user |

### Groww Connection
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/groww/connect` | Save encrypted credentials |
| GET | `/api/groww/status` | Check connection status |
| POST | `/api/groww/sync` | Sync tokens (TOTP) |
| GET | `/api/groww/profile` | Get user profile |
| GET | `/api/groww/funds` | Get available funds |
| GET | `/api/groww/holdings` | Get holdings |
| GET | `/api/groww/positions` | Get open positions |

### Strategies
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/strategies` | List user strategies |
| POST | `/api/strategies` | Create strategy |
| GET | `/api/strategies/:id` | Get strategy |
| PATCH | `/api/strategies/:id` | Update strategy |
| DELETE | `/api/strategies/:id` | Delete strategy |
| POST | `/api/strategies/:id/clone` | Clone strategy |

### Backtesting
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/backtest/run` | Start backtest |
| GET | `/api/backtest/runs` | List backtest runs |
| GET | `/api/backtest/runs/:id` | Get backtest results |
| GET | `/api/backtest/runs/:id/trades` | Get trades for run |
| GET | `/api/backtest/runs/:id/equity` | Get equity curve |
| DELETE | `/api/backtest/runs/:id` | Delete backtest run |

### Trade Auditor
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trades/:id/chart-data` | Get candlestick + EMA data |
| GET | `/api/trades/:id/context` | Get trade context (option chain, etc.) |
| GET | `/api/trades/:id/adjacent` | Get previous/next trade |

### Paper Trading
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/paper/portfolio` | Get portfolio status |
| GET | `/api/paper/positions` | Get open positions |
| POST | `/api/paper/start` | Start paper trading session |
| POST | `/api/paper/stop` | Stop paper trading session |
| POST | `/api/paper/reset` | Reset portfolio |
| GET | `/api/paper/history` | Get trade history |

### Live Trading (Gated)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/live/status` | Get live trading status |
| POST | `/api/live/enable` | Enable live trading (requires 2FA) |
| POST | `/api/live/disable` | Disable live trading |
| POST | `/api/live/emergency-stop` | Emergency close all |
| GET | `/api/live/orders` | Get live orders |
| GET | `/api/live/positions` | Get live positions |

### Market Data
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/market/candles/:symbol` | Get historical candles |
| GET | `/api/market/option-chain/:symbol` | Get option chain |
| GET | `/api/market/quote/:symbol` | Get live quote |
| WS | `/api/market/ws` | WebSocket for real-time data |

### Screener
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/screener/penny-stocks` | Screen penny stocks |
| GET | `/api/screener/results/:id` | Get screener results |
| POST | `/api/screener/backtest` | Backtest on screened stocks |

### Engine Commands (API ↔ Engine via Postgres)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/engine/commands` | Send command to engine |
| GET | `/api/engine/state` | Get engine state |
| GET | `/api/engine/health` | Get engine health |

---

## WebSocket Messages

### Client → Server
```typescript
// Subscribe to market data
{ type: 'subscribe', payload: { symbols: ['NIFTY', 'BANKNIFTY'], timeframe: '1m' } }

// Subscribe to strategy signals
{ type: 'subscribe_signals', payload: { strategyId: 'uuid' } }

// Subscribe to paper trading updates
{ type: 'subscribe_paper', payload: { portfolioId: 'uuid' } }

// Subscribe to live trading updates
{ type: 'subscribe_live', payload: { userId: 'uuid' } }
```

### Server → Client
```typescript
// Market tick
{ type: 'tick', payload: { symbol: 'NIFTY', price: 24500.50, timestamp: '...', volume: 1000 } }

// Candle update (1m)
{ type: 'candle', payload: { symbol: 'NIFTY', timeframe: '1m', o: 24500, h: 24510, l: 24495, c: 24505, v: 5000, t: '...' } }

// Strategy signal
{ type: 'signal', payload: { strategyId: 'uuid', signal: 'BUY'|'SELL', price: 24500, time: '...', metadata: {} } }

// Paper trade executed
{ type: 'paper_trade', payload: { trade: {...}, portfolio: {...} } }

// Live order update
{ type: 'live_order', payload: { order: {...} } }

// Portfolio update
{ type: 'portfolio_update', payload: { cash: 100000, total: 105000, dailyPnl: 5000 } }
```

---

## Strategy Engine Architecture

### Core Modules (Pure Functions - No Side Effects)

```
packages/strategy-core/
├── indicators/
│   ├── ema.ts           # EMA calculation (vectorized)
│   ├── crossover.ts     # Crossover detection
│   └── resample.ts      # 1m → 5m/15m/30m alignment
├── signals/
│   ├── generator.ts     # Signal generation from candles
│   ├── filters.ts       # Entry window, time filters
│   └── reversal.ts      # Immediate reversal logic
├── execution/
│   ├── instrument-resolver.ts  # ATM/ITM strike selection
│   ├── position-sizer.ts   # Lot sizing
│   └── cost-calculator.ts  # Brokerage, STT, slippage
├── backtest/
│   ├── engine.ts        # Event-driven backtest
│   ├── metrics.ts       # Performance metrics
│   └── reporter.ts      # Result formatting
└── types.ts             # Shared TypeScript types
```

### Key Algorithms

#### EMA Calculation (Vectorized with Proper Seeding)
```typescript
function calculateEMA(prices: number[], period: number): (number | NaN)[] {
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
  
  for (let i = period; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i - 1]!) * multiplier + ema[i - 1]!;
  }
  return ema;
}
```

#### Resampling (Aligned to 09:15 IST)
```typescript
function resampleCandles(candles: Candle1m[], timeframe: Timeframe): CandleResampled[] {
  // Aligned to 09:15 market open
  // 5m: 09:15-09:20, 09:20-09:25, ...
  // 15m: 09:15-09:30, 09:30-09:45, ...
  // 30m: 09:15-09:45, 09:45-10:15, ...
}
```

#### Signal Generation
```typescript
function generateSignals(
  spotCandles: CandleResampled[],
  config: StrategyConfig,
  instruments: Instrument[],
  runType: RunType
): Signal[] {
  // 1. Calculate EMAs on spot closes
  // 2. Detect crossovers on CLOSED bars
  // 3. Check exits FIRST (always honored)
  // 4. Check entries (gated by entry window)
  // 5. Handle immediate reversals (within window only)
  // 6. Select strike/expiry for valid signals
}
```

---

## Security Architecture

### Encryption
- **Algorithm**: AES-256-GCM (envelope encryption)
- **Key Derivation**: PBKDF2 with 600,000 iterations
- **Per-field encryption** for API credentials
- **Master key from OS keychain/env** (not in DB)

### Authentication Flow
```
1. User registers → Email verification → 2FA setup
2. Login → JWT access token (15 min) + refresh token (7 days)
3. Groww credentials → Encrypted → Stored in DB
4. TOTP secret → Encrypted → Used for auto-login
5. Live trading → Requires 2FA verification per session
```

### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| Auth | 10/min |
| Market data | 100/min |
| Backtest | 5/min |
| Paper trading | 60/min |
| Live trading | 30/min |
| WebSocket | 1 connection/user |

### Audit Requirements
- Every financial action logged
- Immutable audit trail (append-only via RLS)
- IP + User-Agent tracked
- 7-year retention

---

## Deployment Architecture

### Development
```
Local Machine
├── Bun (API + Frontend dev server + Engine)
├── Neon PostgreSQL (dev branch)
└── ngrok (for Groww webhook testing)
```

### Production
```
┌─────────────────────────────────────────────────────────────────┐
│                      Vercel / Cloudflare                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Frontend   │  │   Edge      │  │   Cron Triggers         │  │
│  │  (Static)   │  │   Functions │  │   (Daily Ingestion)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            ┌───────────────┐   ┌───────────────┐
            │  Neon         │   │  Redis        │
            │  PostgreSQL   │   │  (Upstash)    │
            │  (Main)       │   │  - Sessions   │
            └───────────────┘   │  - Cache      │
                                │  - Rate Limit │
                                └───────────────┘

Always-on Engine Host (VPS/Docker):
┌─────────────────────────────────────────────┐
│  Engine (Bun)                               │
│  - Groww WebSocket                          │
│  - Paper/Live Trading Loop                  │
│  - Reconciliation on Start                  │
│  - Emergency Stop (CLI + API)               │
└─────────────────────────────────────────────┘
```

---

## Monitoring & Observability

### Key Metrics
- API latency (p50, p95, p99)
- WebSocket connection count
- Backtest queue depth
- Trade execution latency
- Error rates by endpoint
- Daily P&L (paper + live)

### Alerting
- API error rate > 1%
- WebSocket disconnects > 5/min
- Backtest failures
- Live trading errors
- Daily loss limit approaching

---

*Architecture version: 2.0 (updated to reflect engine app, split trade tables, corrected schema)*
*Last updated: 2026-11-25*