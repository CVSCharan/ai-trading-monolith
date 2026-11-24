# Groww Trading System - Project Plan

## Project Overview

Building a complete trading lifecycle system for Indian markets using Groww API with:
- **9/21 EMA Crossover Options Strategy** for NIFTY index options
- **Backtesting engine** with 1-minute historical data from Groww API
- **Trade auditing dashboard** with candlestick charts
- **Paper trading** capability
- **Live trading** during market hours

---

## Technology Stack Decision

### Recommended: **Bun + Elysia + React + PostgreSQL**

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Runtime** | Bun | Fast, native TypeScript, built-in test runner, SQLite/Postgres driver |
| **Backend Framework** | Elysia | Type-safe, fast, WebSocket native, OpenAPI auto-gen |
| **Frontend** | React 18 + TypeScript + Vite | Mature ecosystem, great charting libs |
| **Database** | PostgreSQL (Neon) | Serverless, branches for dev, reliable |
| **Charts** | Lightweight Charts (TradingView) | Fast, candlestick native, 60fps |
| **State Management** | TanStack Query + Zustand | Server state + client state |
| **Styling** | Tailwind CSS + shadcn/ui | Modern, accessible components |
| **Auth** | Better Auth | Modern, secure, TypeScript-first |
| **Scheduler** | Bun's native cron / node-cron | Market hours scheduling |

### Why NOT other options?
- **Next.js**: Overkill for dashboard, SSR not needed
- **MERN**: Express lacks type safety, MongoDB not ideal for time-series
- **Python/FastAPI**: Good for ML but slower for real-time WebSocket trading
- **Rust/C++ Desktop**: Over-engineered, distribution complexity
- **Electron/Tauri**: Web app is more accessible

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend (Vite)                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │  Strategy   │ │ Backtest    │ │  Trade      │ │  Paper/   │  │
│  │  Config     │ │ Results     │ │  Auditor    │ │  Live     │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Elysia API      │
                    │   (WebSocket)     │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌───────────────┐
│  PostgreSQL   │   │  Groww API      │   │  Strategy     │
│  (Neon)       │   │  Client         │   │  Engine       │
│               │   │  (REST + WS)    │   │  (Backtest/   │
│  - Trades     │   │                 │   │   Live)       │
│  - Candles    │   │  - Auth (TOTP)  │   │               │
│  - Strategies │   │  - Market Data  │   │  - 9/21 EMA   │
│  - Users      │   │  - Orders       │   │  - Risk Mgmt  │
└───────────────┘   └─────────────────┘   └───────────────┘
```

---

## Phase 1: Foundation (Week 1)

### 1.1 Project Setup
- [ ] Initialize Bun monorepo with workspaces
- [ ] Configure TypeScript strict mode
- [ ] Set up ESLint + Prettier + Husky
- [ ] Create `.env.example` with all required variables
- [ ] Set up PostgreSQL schema (Neon)
- [ ] Configure Better Auth with email/password + 2FA

### 1.2 Database Schema
```sql
-- Core tables
users, strategies, candles_1m, candles_resampled,
trades, backtest_runs, paper_trades, live_orders,
groww_tokens, audit_logs
```

### 1.3 Groww API Client
- [ ] TOTP-based authentication
- [ ] Token refresh management
- [ ] Market data WebSocket subscription
- [ ] Historical data downloader (1m candles)
- [ ] Order placement (buy/sell options)
- [ ] Position/portfolio fetching

---

## Phase 2: Strategy Engine (Week 2)

### 2.1 Core Indicators
- [ ] EMA calculation (9, 21) - vectorized for performance
- [ ] Crossover detection (bullish/bearish)
- [ ] Resampling 1m → 5m/15m/30m aligned to 09:15

### 2.2 Strategy Configuration
```typescript
interface StrategyConfig {
  symbol: 'NIFTY' | 'BANKNIFTY' | string;
  timeframe: '5m' | '15m' | '30m';
  entryWindow: { start: '09:30' | '10:00' | '10:30'; end: '11:30' | '12:00' | '12:30' | '13:00' | '13:30' | '14:00' | '14:30' };
  exitTime: '15:00';
  executionMode: 'DEEP_ITM_BUY' | 'ATM_BUY' | 'ATM_SELL';
  lotSize: 65;
  lots: 1;
  strikeOffset: 5; // for Deep ITM
}
```

### 2.3 Backtest Engine
- [ ] Event-driven backtest on 1m data
- [ ] Signal generation with entry window filter
- [ ] Exit logic: opposite crossover OR 15:00 square-off
- [ ] Immediate reversal handling
- [ ] P&L calculation with realistic costs (brokerage, STT, slippage)
- [ ] Metrics: Sharpe, max drawdown, win rate, profit factor

---

## Phase 3: Frontend Dashboard (Week 3)

### 3.1 Pages
| Route | Purpose |
|-------|---------|
| `/` | Dashboard overview |
| `/strategy/builder` | Strategy configuration |
| `/backtest/results/:id` | Backtest results with equity curve |
| `/trade-auditor/:tradeId` | Candlestick chart with trade markers |
| `/paper-trading` | Paper trading control panel |
| `/live-trading` | Live trading monitor (read-only until approved) |
| `/settings` | API keys, preferences |

### 3.2 Components
- **StrategyBuilder**: Form with all config options
- **EquityChart**: Lightweight Charts area chart
- **TradeCandlestickChart**: Candlesticks + entry/exit markers + EMA lines
- **MetricsTable**: Key performance indicators
- **TradeList**: Paginated, filterable trade history
- **PositionPanel**: Current positions with unrealized P&L

### 3.3 Trade Auditor (Critical)
- Load 1m candles around trade ± 30 min
- Overlay 9/21 EMA on selected timeframe
- Mark entry/exit with tooltips showing price, time, P&L
- Show option chain snapshot at entry
- Keyboard navigation (←/→ for next/prev trade)

---

## Phase 4: Paper & Live Trading (Week 4)

### 4.1 Paper Trading
- [ ] Virtual portfolio with ₹10L starting capital
- [ ] Real-time signal generation via WebSocket
- [ ] Simulated order execution (next tick open)
- [ ] Position tracking with MTM
- [ ] Daily P&L report

### 4.2 Live Trading (Gated)
- [ ] **Require explicit user approval per session**
- [ ] Pre-trade risk checks (max positions, daily loss limit)
- [ ] Order management: place, modify, cancel
- [ ] WebSocket position updates
- [ ] Emergency kill switch (closes all positions)
- [ ] Audit trail for every action

### 4.3 Risk Management
- Max 3 concurrent positions
- Daily loss limit: 2% of capital
- Per-trade risk: 1% of capital
- No trading first 15 min / last 15 min (configurable)

---

## Phase 5: Penny Stock Analysis Module (Week 5)

### 5.1 Screener
- [ ] Fetch NSE equity list
- [ ] Filter: price < ₹50, volume > 1L, market cap < ₹500Cr
- [ ] Technical filters: RSI, volume spike, breakout patterns
- [ ] Fundamental data (if available): PE, debt/equity, promoter holding

### 5.2 Strategy Lab
- [ ] Backtest multiple strategies on screened stocks
- [ ] Walk-forward optimization
- [ ] Monte Carlo simulation
- [ ] Strategy comparison matrix

---

## Environment Variables (`.env.example`)

```bash
# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/trading?sslmode=require
DATABASE_POOL_SIZE=10

# Authentication
BETTER_AUTH_SECRET=your-32-char-secret-here
BETTER_AUTH_URL=http://localhost:3000

# Groww API
GROWW_API_KEY=your-groww-api-key
GROWW_API_SECRET=your-groww-api-secret
GROWW_TOTP_SECRET=your-totp-secret-from-keys.txt
GROWW_REDIRECT_URI=http://localhost:3000/api/auth/groww/callback

# Market Data
NSE_MARKET_OPEN=09:15
NSE_MARKET_CLOSE=15:30
TIMEZONE=Asia/Kolkata

# Risk Management
MAX_DAILY_LOSS_PCT=2
MAX_POSITIONS=3
PER_TRADE_RISK_PCT=1
PAPER_TRADING_CAPITAL=1000000

# Feature Flags
ENABLE_LIVE_TRADING=false
ENABLE_PAPER_TRADING=true
ENABLE_BACKTEST=true
```

---

## Security Best Practices

1. **Never commit `.env`** - Use `.env.example` only
2. **TOTP secret encrypted** at rest (AES-256)
3. **API keys rotated** quarterly
4. **Rate limiting** on all API endpoints
5. **Input validation** with Zod schemas
6. **Audit logging** for all financial operations
7. **Read-only mode** for live trading by default
8. **Two-factor auth** mandatory for live trading

---

## File Structure

```
groww-trading-system/
├── apps/
│   ├── api/                    # Elysia backend
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── strategies.ts
│   │   │   │   ├── backtest.ts
│   │   │   │   ├── trades.ts
│   │   │   │   ├── market-data.ts
│   │   │   │   ├── paper-trading.ts
│   │   │   │   └── live-trading.ts
│   │   │   ├── services/
│   │   │   │   ├── groww-client.ts
│   │   │   │   ├── strategy-engine.ts
│   │   │   │   ├── backtest-engine.ts
│   │   │   │   ├── risk-manager.ts
│   │   │   │   └── scheduler.ts
│   │   │   ├── db/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── migrations/
│   │   │   │   └── seed.ts
│   │   │   ├── utils/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   │   ├── charts/
│       │   │   ├── forms/
│       │   │   ├── tables/
│       │   │   └── ui/
│       │   ├── hooks/
│       │   ├── stores/
│       │   ├── services/
│       │   ├── types/
│       │   ├── utils/
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── packages/
│   ├── shared/                 # Shared types, constants
│   │   ├── types/
│   │   ├── constants/
│   │   └── validators/
│   │
│   └── strategy-core/          # Pure strategy logic (no deps)
│       ├── indicators/
│       ├── signals/
│       ├── execution/
│       └── backtest/
│
├── docs/
│   ├── PROJECT_PLAN.md
│   ├── ARCHITECTURE.md
│   ├── API_REFERENCE.md
│   ├── STRATEGY_DOCS.md
│   └── DEPLOYMENT.md
│
├── .env.example
├── package.json                # Root workspace
├── turbo.json                  # Turborepo config
└── README.md
```

---

## Development Workflow

```bash
# Start all services
bun run dev

# Run tests
bun test

# Type check
bun run typecheck

# Lint
bun run lint

# Database commands
bun run db:generate
bun run db:migrate
bun run db:seed
bun run db:studio
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Backtest speed | < 5 sec for 1 year NIFTY 1m data |
| API latency (p95) | < 100ms |
| WebSocket reconnection | < 2 sec |
| Test coverage | > 80% |
| Zero critical security findings | Pass |

---

## Next Steps

1. **Approve this plan** - Confirm tech stack and phases
2. **Create `.env`** - Add your Groww credentials
3. **Initialize project** - Run setup commands
4. **Phase 1 kickoff** - Foundation setup

---

*Document created: 2026-11-24*
*Version: 1.0*