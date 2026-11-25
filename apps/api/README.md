# Groww Trading API

Backend API for the Groww Trading System.

## Tech Stack

- **Runtime**: Bun >= 1.1.0
- **Framework**: Elysia (Type-safe, fast, WebSocket native)
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Auth**: Better Auth (email/password + 2FA)
- **Encryption**: Envelope encryption (AES-256-GCM)
- **Market Data**: Groww REST API + WebSocket

## Documentation

- [Project Plan](../../docs/project-plan.md)
- [Architecture](../../docs/architecture.md)
- [Strategy Specification](../../docs/strategy-docs-v2.md)
- [Phase 1 Specification](../../docs/phase1-spec.md)

## Quick Start

```bash
# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Database
bun run db:generate
bun run db:migrate
bun run db:seed

# Development
bun run dev

# Build
bun run build

# Test
bun test

# Type check
bun run typecheck
```

## Project Structure

```
groww-ai-trading-monolith/
├── apps/api/
│   ├── docs/                      # API documentation
│   ├── src/
│   │   ├── routes/                # API route handlers
│   │   │   ├── auth.ts            # Better Auth integration
│   │   │   ├── strategies.ts      # Strategy CRUD
│   │   │   ├── backtest.ts        # Backtest execution
│   │   │   ├── trades.ts          # Trade audit
│   │   │   ├── market-data.ts     # Market data & WebSocket
│   │   │   ├── paper-trading.ts   # Paper trading
│   │   │   └── live-trading.ts    # Live trading (gated)
│   │   ├── services/              # Business logic
│   │   │   ├── groww-client.ts    # Groww API client
│   │   │   ├── strategy-engine.ts # Strategy orchestration
│   │   │   ├── backtest-engine.ts # Backtest runner
│   │   │   ├── risk-manager.ts    # Risk enforcement
│   │   │   └── scheduler.ts       # Market hours scheduler
│   │   ├── db/                    # Database
│   │   │   ├── schema.ts          # Drizzle schema
│   │   │   ├── migrations/        # SQL migrations
│   │   │   └── seed.ts            # Instrument master seed
│   │   ├── middleware/            # Elysia middleware
│   │   │   ├── auth.ts            # Auth guard
│   │   │   ├── rate-limit.ts      # Rate limiting
│   │   │   └── audit.ts           # Audit logging
│   │   └── index.ts               # App entry point
├── .env.example
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── vercel.json
```

## Environment Variables

See `.env.example` for all required variables:

```bash
# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/trading?sslmode=require

# Better Auth
BETTER_AUTH_SECRET=your-32-char-secret
BETTER_AUTH_URL=http://localhost:3000

# Encryption (KEK from OS keychain)
ENCRYPTION_MASTER_KEY=your-32-byte-hex-key

# Groww API
GROWW_API_KEY=your-api-key
GROWW_API_SECRET=your-api-secret
GROWW_TOTP_SECRET=your-totp-secret

# Feature Flags
ENABLE_LIVE_TRADING=false
ENABLE_PAPER_TRADING=true
ENABLE_BACKTEST=true
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/2fa/enable` - Enable 2FA
- `POST /api/auth/2fa/verify` - Verify 2FA code
- `GET /api/auth/me` - Current user

### Groww Connection
- `POST /api/groww/connect` - Save credentials
- `GET /api/groww/status` - Connection status
- `POST /api/groww/sync` - Refresh tokens
- `GET /api/groww/profile` - User profile
- `GET /api/groww/funds` - Available funds

### Strategies
- `GET /api/strategies` - List strategies
- `POST /api/strategies` - Create strategy
- `GET /api/strategies/:id` - Get strategy
- `PATCH /api/strategies/:id` - Update strategy
- `DELETE /api/strategies/:id` - Delete strategy

### Backtesting
- `POST /api/backtest/run` - Start backtest
- `GET /api/backtest/runs` - List runs
- `GET /api/backtest/runs/:id` - Get results
- `GET /api/backtest/runs/:id/trades` - Get trades
- `GET /api/backtest/runs/:id/equity` - Equity curve

### Trade Auditor
- `GET /api/trades/:id/chart-data` - Candlestick + EMA data
- `GET /api/trades/:id/context` - Trade context
- `GET /api/trades/:id/adjacent` - Previous/next trade

### Paper Trading
- `GET /api/paper/portfolio` - Portfolio status
- `GET /api/paper/positions` - Open positions
- `POST /api/paper/start` - Start session
- `POST /api/paper/stop` - Stop session
- `GET /api/paper/history` - Trade history

### Live Trading (Gated)
- `GET /api/live/status` - Live status
- `POST /api/live/enable` - Enable (requires 2FA)
- `POST /api/live/disable` - Disable
- `POST /api/live/emergency-stop` - Emergency close all
- `GET /api/live/orders` - Live orders
- `GET /api/live/positions` - Live positions

### Market Data
- `GET /api/market/candles/:symbol` - Historical candles
- `GET /api/market/option-chain/:symbol` - Option chain
- `WS /api/market/ws` - Real-time WebSocket

### WebSocket Messages

**Client → Server**
```json
{ "type": "subscribe", "payload": { "symbols": ["NIFTY"], "timeframe": "1m" } }
{ "type": "subscribe_signals", "payload": { "strategyId": "uuid" } }
{ "type": "subscribe_paper", "payload": { "portfolioId": "uuid" } }
```

**Server → Client**
```json
{ "type": "tick", "payload": { "symbol": "NIFTY", "price": 24500.50, "timestamp": "..." } }
{ "type": "signal", "payload": { "strategyId": "uuid", "signal": "BUY", "price": 24500 } }
{ "type": "paper_trade", "payload": { "trade": {...}, "portfolio": {...} } }
```

## Strategy Core Package

The `packages/strategy-core` contains pure TypeScript logic with **zero external dependencies**:

- **Indicators**: EMA (proper seeding), Resampling (09:15 aligned), Crossover detection
- **Signals**: Generator with correct exit/entry logic
- **Execution**: Strike/expiry selection, Cost calculator (dated config)
- **Backtest**: Event-driven engine with metrics

Run tests: `cd packages/strategy-core && bun test`

## Database Schema

Key tables (see `src/db/schema.ts`):
- `user_profiles` - Trading preferences (extends Better Auth `user`)
- `instruments` - Master table with lot sizes, strike steps, validity periods
- `candles_1m` - 1-minute OHLCV (partitioned by month)
- `candles_resampled` - 5m/15m/30m bars (raw OHLCV only)
- `strategies` - User strategy configurations
- `signals` - Audit trail for every signal
- `backtest_runs` / `backtest_trades` - Backtest results
- `paper_portfolios` / `paper_positions` / `paper_trades` - Paper trading
- `live_fills` / `live_positions` - Live trading (audit-critical)
- `audit_logs` - Immutable audit trail (RLS protected)
- `cost_configs` - Dated cost configuration
- `engine_commands` / `engine_state` - API ↔ Engine bridge
- `reconciliation_state` - Crash recovery state

## Security

- **Envelope encryption**: DEK per credential, KEK from OS keychain
- **TOTP secrets**: Encrypted at rest, never logged
- **2FA**: Required for live trading (Better Auth)
- **Risk enforcement**: Server-side only (daily loss, position limits, margin)
- **Idempotency**: Client-generated keys for every order
- **Audit logs**: INSERT-only via RLS, 7-year retention

## Testing

```bash
# Unit tests (strategy-core)
cd packages/strategy-core && bun test

# Integration tests (API)
bun test --match="*integration*"

# Coverage
bun test --coverage
```

## Deployment

### Development
```bash
bun run dev  # Hot reload with --watch
```

### Production (Vercel Functions)
```bash
bun run build
NODE_ENV=production node dist/index.js
```

### Systemd Service
```ini
[Unit]
Description=Groww Trading API
After=network.target

[Service]
Type=simple
User=trading
WorkingDirectory=/opt/groww-trading-api
ExecStart=/usr/local/bin/bun run start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Monitoring

- Health check: `GET /health`
- Metrics: Prometheus format at `GET /metrics`
- Logs: Pino JSON (stdout)

## License

Private - Internal use only