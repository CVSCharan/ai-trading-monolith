# Groww Trading Engine

Long-lived trading engine for paper & live trading. Runs on VPS/Docker with fixed IP for Groww API access.

## Tech Stack

- **Runtime**: Bun >= 1.1.0
- **Framework**: Elysia (for health checks / metrics)
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Market Data**: Groww WebSocket + REST API
- **Encryption**: Envelope encryption (AES-256-GCM)

## Documentation

- [Project Plan](../../docs/project-plan.md)
- [Architecture](../../docs/architecture.md)
- [Strategy Specification](../../docs/strategy-docs-v2.md)

## Quick Start

```bash
# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env with your credentials (Groww API keys, TOTP, encryption key)

# Development
bun run dev

# Build
bun run build

# Start
bun run start

# Test
bun test

# Type check
bun run typecheck
```

## Project Structure

```
apps/engine/
├── docs/                      # Engine documentation
├── src/
│   ├── index.ts               # Entry point - main engine loop
│   ├── config.ts              # Environment configuration
│   ├── db/                    # Database schema (shared with API)
│   │   └── command-state.ts   # Engine commands & state tables
│   └── services/              # Business logic
│       ├── websocket-manager.ts   # Groww WebSocket connection
│       ├── groww-client.ts        # Groww REST API client
│       ├── command-processor.ts   # Process API commands
│       ├── reconciliation.ts      # Crash recovery
│       ├── market-data.ts         # Candle building from ticks
│       ├── paper-trading.ts       # Paper trading engine
│       └── live-trading.ts        # Live trading engine
├── .env.example
├── package.json
└── tsconfig.json
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/trading?sslmode=require

# JWT for internal auth
JWT_SECRET=your-32-char-secret

# Groww API
GROWW_API_BASE_URL=https://api.groww.in

# Engine
HOST_ID=engine-1
PORT=3001
LOG_LEVEL=info

# Market hours
MARKET_OPEN=09:15
MARKET_CLOSE=15:30
TIMEZONE=Asia/Kolkata

# Polling intervals (ms)
COMMAND_POLL_INTERVAL=2000
HEARTBEAT_INTERVAL=10000
STATE_PUBLISH_INTERVAL=5000

# Reconciliation
RECONCILE_ON_START=true
MAX_RECONCILIATION_DAYS=1

# Risk defaults
DEFAULT_MAX_DAILY_LOSS_PCT=2
DEFAULT_MAX_POSITIONS=3
DEFAULT_PER_TRADE_RISK_PCT=1
```

## Engine Architecture

### Main Loop
```
1. Receive 1m ticks via Groww WebSocket
2. Build resampled candles (5m/15m/30m)
3. Update StreamingEMA
4. Generate signals via StreamingSignalGenerator
5. Check exits FIRST (always honored)
6. Check entries (gated by entry window)
7. Place orders via Groww REST API
8. Update engine_state
```

### Command Processor
Polls `engine_commands` table for:
- `start_paper` - Start paper trading session
- `stop_paper` - Stop paper trading
- `enable_live` - Enable live trading (requires 2FA)
- `disable_live` - Disable live trading
- `emergency_stop` - Cancel all + close all
- `update_risk` - Update risk parameters

### State Management
Writes to `engine_state` table for dashboard polling:
- Current positions with MTM
- Daily P&L
- Open orders
- Last signal
- Risk metrics

### Reconciliation (Crash Recovery)
On startup:
1. Load last processed bar from `reconciliation_state`
2. Fetch current positions from Groww
3. Compare with DB positions
4. Reconcile discrepancies
5. Resume from last processed bar

## Trading Loop Details

### Signal Generation
- Uses `StreamingSignalGenerator` from `strategy-core`
- Maintains EMA state across bars
- Handles entry window, exits, reversals
- Position state resets at 15:00

### Order Execution
```typescript
// Idempotency key generated before API call
const idempotencyKey = crypto.randomUUID();
await db.insert(liveFills).values({ ..., idempotencyKey });
await growwClient.placeOrder({ ..., idempotencyKey });
```

### Risk Enforcement (Server-side ONLY)
- Daily loss limit check before every order
- Position limits check
- Margin check
- 15:00 square-off unconditional
- Short option stop-loss (premium doubles)

### Idempotency
- Every order: generate UUID → store in `live_fills` → place order
- Prevents duplicate orders on retry

### Crash Recovery
- On startup: reconcile with Groww positions
- Load last processed bar, open signals
- Replay missed bars if gap < 1 day

## Deployment

### VPS (systemd)
```ini
[Unit]
Description=Groww Trading Engine
After=network.target

[Service]
Type=simple
User=trading
WorkingDirectory=/opt/groww-trading-engine
ExecStart=/usr/local/bin/bun run start
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/groww-ai-trading-monolith/.env

[Install]
WantedBy=multi-user.target
```

### Docker
```dockerfile
FROM oven/bun:1.1
WORKDIR /app
COPY package*.json ./
RUN bun install
COPY . .
RUN bun run build
EXPOSE 3001
CMD ["bun", "run", "start"]
```

### Environment Variables (Production)
```bash
# Use OS keychain for ENCRYPTION_MASTER_KEY
# systemd: LoadCredential=ENCRYPTION_MASTER_KEY
# Or: export ENCRYPTION_MASTER_KEY=$(cat /run/secrets/encryption_key)
```

## Commands

```bash
# Development
bun run dev          # Hot reload with --watch

# Build
bun run build        # Compile to dist/

# Production
bun run start        # bun run dist/index.js

# Test
bun test

# Type check
bun run typecheck

# Lint
bun run lint
```

## Monitoring

- Health check: `GET /health`
- Metrics: `GET /metrics` (basic)
- Logs: Pino JSON (stdout)

## License

Private - Internal use only