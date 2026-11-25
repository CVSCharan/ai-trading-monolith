# Groww Trading System

A complete trading lifecycle system for Indian markets using Groww API.

## Monorepo Structure (Bun Workspaces)

```
groww-ai-trading-monolith/
├── apps/
│   ├── api/           # Elysia backend (Vercel Functions)
│   ├── web/           # React frontend (Vercel Static)
│   └── engine/        # Long-lived trading engine (VPS/Docker)
├── packages/
│   ├── strategy-core/ # Pure strategy logic (no deps)
│   └── shared/        # Types, constants, timezone helpers
├── docs/              # Master documentation
├── turbo.json         # Turborepo config
├── package.json       # Root workspace
├── tsconfig.json      # Base TypeScript config
└── CLAUDE.md          # Project rules
```

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
# From root - single install for all workspaces
cd groww-ai-trading-monolith
bun install

# Setup environment
cp .env.example .env
# Edit .env with your credentials (Neon DB, Groww API keys, etc.)

# Database setup (API only)
cd apps/api
bun run db:generate
bun run db:migrate
bun run db:seed

# Start all services (API, Web, Engine)
cd ../..
bun run dev
```

### Individual App Commands

```bash
# API (Elysia + Better Auth)
cd apps/api
bun run dev          # Dev with hot reload
bun run build        # Build for production
bun run test         # Run tests
bun run db:studio    # Drizzle Studio

# Web (React + Vite)
cd apps/web
bun run dev          # Vite dev server
bun run build        # Production build
bun run preview      # Preview build

# Engine (Long-lived process)
cd apps/engine
bun run dev          # Dev with hot reload
bun run start        # Production start
```

### Database (API only)
```bash
cd apps/api
bun run db:generate   # Generate migrations
bun run db:migrate    # Run migrations
bun run db:push       # Push schema (dev)
bun run db:studio     # Drizzle Studio
bun run db:seed       # Seed instruments
```

## Strategy Overview

**9/21 EMA Crossover on NIFTY Options**
- Timeframes: 5m, 15m, 30m (resampled from 1m, aligned to 09:15)
- Entry window: Configurable (09:30-11:30 default)
- Exit: Opposite crossover or 15:00 mandatory square-off
- Immediate reversal: Opposite crossover within window closes and reverses
- Execution modes: Deep ITM Buy, ATM Buy, ATM Sell
- Lot size: From `instruments` table (NIFTY: 75 current), 1 lot per trade

## Development

### Running Tests
```bash
# All tests (from root)
bun test

# Individual packages
cd packages/strategy-core && bun test
cd apps/api && bun test
cd apps/web && bun test
```

### Type Checking
```bash
# All packages
bun run typecheck

# Individual
cd packages/strategy-core && bun run typecheck
cd apps/api && bun run typecheck
cd apps/web && bun run typecheck
```

### Database (API only)
```bash
cd apps/api
bun run db:generate   # Generate migrations
bun run db:migrate    # Run migrations
bun run db:push       # Push schema (dev)
bun run db:studio     # Drizzle Studio
bun run db:seed       # Seed instruments
```

## Project Structure

```
groww-ai-trading-monolith/
├── apps/
│   ├── api/           # Elysia backend (Vercel Functions)
│   ├── web/           # React frontend (Vercel Static)
│   └── engine/        # Long-lived trading engine (VPS/Docker)
├── packages/
│   ├── strategy-core/ # Pure strategy logic (no deps)
│   └── shared/        # Types, constants, timezone helpers
├── docs/              # Master documentation
├── turbo.json         # Turborepo config
├── package.json       # Root workspace
├── tsconfig.json      # Base TypeScript config
└── CLAUDE.md          # Project rules
```

## Deployment Targets

| App | Platform | Root Directory | Build Command |
|-----|----------|----------------|---------------|
| web | Vercel (Static) | `apps/web` | `bun run build` |
| api | Vercel (Functions) | `apps/api` | `bun run build` |
| engine | VPS/Docker | `apps/engine` | `bun run build` |

## Security

- All API credentials encrypted at rest (envelope encryption)
- TOTP secrets never logged
- 2FA required for live trading
- Server-side risk enforcement (cannot bypass from client)
- Audit logging for all financial operations
- Rate limiting on all endpoints

## License

Private - Internal use only