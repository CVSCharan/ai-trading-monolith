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
-- Users & Auth
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    two_factor_secret VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groww API Credentials (encrypted)
CREATE TABLE groww_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    api_key_encrypted BYTEA NOT NULL,
    api_secret_encrypted BYTEA NOT NULL,
    totp_secret_encrypted BYTEA NOT NULL,
    access_token_encrypted BYTEA,
    refresh_token_encrypted BYTEA,
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategies
CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) NOT NULL, -- NIFTY, BANKNIFTY, etc.
    timeframe VARCHAR(10) NOT NULL, -- 5m, 15m, 30m
    entry_start_time TIME NOT NULL, -- 09:30, 10:00, 10:30
    entry_end_time TIME NOT NULL,   -- 11:30 to 14:30
    exit_time TIME NOT NULL DEFAULT '15:00',
    execution_mode VARCHAR(20) NOT NULL, -- DEEP_ITM_BUY, ATM_BUY, ATM_SELL
    lot_size INTEGER NOT NULL DEFAULT 65,
    lots INTEGER NOT NULL DEFAULT 1,
    strike_offset INTEGER DEFAULT 5, -- For Deep ITM
    risk_params JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-minute Candles (raw from Groww)
CREATE TABLE candles_1m (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    open DECIMAL(12,2) NOT NULL,
    high DECIMAL(12,2) NOT NULL,
    low DECIMAL(12,2) NOT NULL,
    close DECIMAL(12,2) NOT NULL,
    volume BIGINT NOT NULL,
    oi BIGINT, -- Open Interest for options
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, timestamp)
);
CREATE INDEX idx_candles_1m_symbol_time ON candles_1m(symbol, timestamp DESC);

-- Resampled Candles (5m, 15m, 30m aligned to 09:15)
CREATE TABLE candles_resampled (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    timeframe VARCHAR(10) NOT NULL, -- 5m, 15m, 30m
    timestamp TIMESTAMPTZ NOT NULL, -- Bar open time
    open DECIMAL(12,2) NOT NULL,
    high DECIMAL(12,2) NOT NULL,
    low DECIMAL(12,2) NOT NULL,
    close DECIMAL(12,2) NOT NULL,
    volume BIGINT NOT NULL,
    ema_9 DECIMAL(12,4),
    ema_21 DECIMAL(12,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, timeframe, timestamp)
);
CREATE INDEX idx_candles_resampled_lookup ON candles_resampled(symbol, timeframe, timestamp DESC);

-- Backtest Runs
CREATE TABLE backtest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_capital DECIMAL(15,2) NOT NULL,
    final_capital DECIMAL(15,2),
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    max_drawdown DECIMAL(10,2),
    sharpe_ratio DECIMAL(10,4),
    profit_factor DECIMAL(10,4),
    win_rate DECIMAL(5,2),
    avg_win DECIMAL(12,2),
    avg_loss DECIMAL(12,2),
    max_consecutive_wins INTEGER,
    max_consecutive_losses INTEGER,
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual Trades (Backtest + Paper + Live)
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backtest_run_id UUID REFERENCES backtest_runs(id) ON DELETE SET NULL,
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trade_type VARCHAR(20) NOT NULL, -- backtest, paper, live
    symbol VARCHAR(50) NOT NULL,
    option_symbol VARCHAR(100), -- NIFTY24JAN18000CE
    side VARCHAR(10) NOT NULL, -- BUY, SELL
    entry_time TIMESTAMPTZ NOT NULL,
    entry_price DECIMAL(12,2) NOT NULL,
    exit_time TIMESTAMPTZ,
    exit_price DECIMAL(12,2),
    quantity INTEGER NOT NULL, -- lots * lot_size
    pnl DECIMAL(12,2),
    pnl_pct DECIMAL(8,4),
    exit_reason VARCHAR(50), -- OPPOSITE_CROSSOVER, SQUARE_OFF, REVERSAL, MANUAL
    status VARCHAR(20) DEFAULT 'open', -- open, closed, cancelled
    metadata JSONB DEFAULT '{}', -- strike, IV, greeks, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_trades_strategy_time ON trades(strategy_id, entry_time DESC);
CREATE INDEX idx_trades_user_type ON trades(user_id, trade_type, entry_time DESC);

-- Paper Trading Portfolio
CREATE TABLE paper_portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    cash_balance DECIMAL(15,2) NOT NULL DEFAULT 1000000,
    total_value DECIMAL(15,2) NOT NULL DEFAULT 1000000,
    daily_pnl DECIMAL(15,2) DEFAULT 0,
    max_daily_loss DECIMAL(15,2) DEFAULT 20000, -- 2%
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Paper Positions
CREATE TABLE paper_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES paper_portfolios(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    option_symbol VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL, -- LONG, SHORT
    quantity INTEGER NOT NULL,
    avg_entry_price DECIMAL(12,2) NOT NULL,
    current_price DECIMAL(12,2),
    unrealized_pnl DECIMAL(12,2) DEFAULT 0,
    realized_pnl DECIMAL(12,2) DEFAULT 0,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    UNIQUE(portfolio_id, option_symbol)
);

-- Live Orders (Audit Trail)
CREATE TABLE live_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
    groww_order_id VARCHAR(100),
    symbol VARCHAR(50) NOT NULL,
    option_symbol VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL, -- BUY, SELL
    order_type VARCHAR(20) NOT NULL, -- MARKET, LIMIT
    quantity INTEGER NOT NULL,
    price DECIMAL(12,2),
    trigger_price DECIMAL(12,2),
    status VARCHAR(30) NOT NULL, -- PENDING, OPEN, COMPLETE, CANCELLED, REJECTED
    filled_quantity INTEGER DEFAULT 0,
    avg_fill_price DECIMAL(12,2),
    placed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Audit Logs (Immutable)
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
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

-- Market Data Cache (Option Chains, etc.)
CREATE TABLE market_data_cache (
    id BIGSERIAL PRIMARY KEY,
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_market_data_cache_expires ON market_data_cache(expires_at);
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
| GET | `/api/trades/adjacent/:id` | Get previous/next trade |

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
│   ├── option-selector.ts  # ATM/ITM strike selection
│   ├── position-sizer.ts   # Lot sizing
│   └── cost-calculator.ts  # Brokerage, STT, slippage
├── backtest/
│   ├── engine.ts        # Event-driven backtest
│   ├── metrics.ts       # Performance metrics
│   └── reporter.ts      # Result formatting
└── types.ts             # Shared TypeScript types
```

### Key Algorithms

#### EMA Calculation (Vectorized)
```typescript
function calculateEMA(prices: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const ema = new Array(prices.length);
  ema[0] = prices[0]; // SMA for first value
  
  for (let i = 1; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  return ema;
}
```

#### Resampling (Aligned to 09:15)
```typescript
function resampleToTimeframe(
  candles: Candle1m[], 
  timeframe: '5m' | '15m' | '30m'
): CandleResampled[] {
  const minutes = { '5m': 5, '15m': 15, '30m': 30 }[timeframe];
  const marketOpen = '09:15'; // IST
  
  // Group by aligned timeframe boundaries
  // 09:15-09:20, 09:20-09:25, etc. for 5m
}
```

#### Signal Generation
```typescript
function generateSignals(
  candles: CandleResampled[],
  config: StrategyConfig
): Signal[] {
  // 1. Calculate EMA 9 and 21
  // 2. Detect crossovers (bullish: ema9 crosses above ema21)
  // 3. Filter by entry window
  // 4. Handle immediate reversals
  // 5. Apply exit logic (opposite crossover or 15:00)
}
```

---

## Security Architecture

### Encryption
- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Per-field encryption** for API credentials
- **Key rotation** every 90 days

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
- Immutable audit trail (append-only)
- IP + User-Agent tracked
- 7-year retention

---

## Deployment Architecture

### Development
```
Local Machine
├── Bun (API + Frontend dev server)
├── Neon PostgreSQL (dev branch)
└── ngrok (for Groww webhook testing)
```

### Production (Recommended)
```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare / Vercel                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Frontend   │  │   Edge      │  │   Cron Triggers     │  │
│  │  (Static)   │  │   Functions │  │   (Market Hours)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
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

*Architecture version: 1.0*
*Last updated: 2026-11-24*