# Groww Trading System

A complete trading lifecycle system for Indian markets using Groww API.

## Repositories

| Repository | Description | Tech Stack |
|------------|-------------|------------|
| [`groww-trading-api`](groww-trading-api) | Backend API with strategy engine, backtesting, paper/live trading | Bun + Elysia + PostgreSQL |
| [`groww-trading-web`](groww-trading-web) | Frontend dashboard for strategy config, backtest results, trade auditing | React + Vite + Tailwind |
| [`groww-trading-shared`](groww-trading-shared) | Shared types, constants, timezone utilities | TypeScript |

## Documentation

- [Project Plan](docs/project-plan.md) - Overall project roadmap and phases
- [Architecture](docs/architecture.md) - System architecture and data flow
- [Strategy Specification](docs/strategy-docs-v2.md) - 9/21 EMA crossover options strategy
- [Phase 1 Specification](docs/phase1-spec.md) - Detailed Phase 1 implementation plan

## Quick Start

### Prerequisites
- Bun >= 1.1.0
- PostgreSQL (Neon recommended)
- Groww API credentials with TOTP

### Setup

```bash
# Clone and setup API
cd groww-trading-api
cp .env.example .env
# Edit .env with your credentials
bun install
bun run db:migrate
bun run db:seed
bun run dev

# Setup Web (in another terminal)
cd groww-trading-web
cp .env.example .env
bun install
bun run dev
```

## Strategy Overview

**9/21 EMA Crossover on NIFTY Options**
- Timeframes: 5m, 15m, 30m (resampled from 1m, aligned to 09:15)
- Entry window: Configurable (09:30-11:30 default)
- Exit: Opposite crossover or 15:00 mandatory square-off
- Immediate reversal: Opposite crossover within window closes and reverses
- Execution modes: Deep ITM Buy, ATM Buy, ATM Sell
- Lot size: 75 (NIFTY current), 1 lot per trade

## Development

### Running Tests
```bash
# API tests
cd groww-trading-api && bun test

# Web tests
cd groww-trading-web && bun test

# Shared tests
cd groww-trading-shared && bun test
```

### Type Checking
```bash
# All packages
cd groww-trading-api && bun run typecheck
cd groww-trading-web && bun run typecheck
cd groww-trading-shared && bun run typecheck
```

### Database
```bash
# Generate migrations
cd groww-trading-api && bun run db:generate

# Run migrations
cd groww-trading-api && bun run db:migrate

# Push schema (dev)
cd groww-trading-api && bun run db:push

# Open Drizzle Studio
cd groww-trading-api && bun run db:studio
```

## Project Structure

```
groww-trading-system/
├── docs/                      # Master documentation
│   ├── project-plan.md
│   ├── architecture.md
│   ├── strategy-docs-v2.md
│   └── phase1-spec.md
├── groww-trading-api/         # Backend API
│   ├── docs/                  # API-specific docs
│   ├── packages/
│   │   └── strategy-core/     # Pure strategy logic (no deps)
│   ├── src/
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   ├── db/                # Database schema & migrations
│   │   └── index.ts           # Entry point
│   └── package.json
├── groww-trading-web/         # Frontend Dashboard
│   ├── docs/                  # Web-specific docs
│   ├── src/
│   │   ├── pages/             # Page components
│   │   ├── components/        # Reusable components
│   │   ├── hooks/             # Custom hooks
│   │   ├── stores/            # Zustand stores
│   │   ├── services/          # API clients
│   │   └── main.tsx           # Entry point
│   └── package.json
└── groww-trading-shared/      # Shared package
    ├── docs/                  # Shared docs
    ├── src/
    │   ├── constants.ts       # Shared constants
    │   ├── timezone.ts        # IST timezone utilities
    │   └── types.ts           # Shared types
    └── package.json
```

## Security

- All API credentials encrypted at rest (envelope encryption)
- TOTP secrets never logged
- 2FA required for live trading
- Server-side risk enforcement (cannot bypass from client)
- Audit logging for all financial operations
- Rate limiting on all endpoints

## License

Private - Internal use only