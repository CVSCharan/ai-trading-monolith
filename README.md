# AI Trader — Quantitative Options & Multi-Broker Algorithmic Terminal

A high-performance algorithmic trading platform for Indian markets (NSE, BSE, MCX) supporting **Groww** and **Upstox** (API v3 & Analytics), featuring quantitative 9/21 EMA strategies, paper bot execution, durable PostgreSQL audit trails, and strict risk guardrails.

## Monorepo Structure (Bun Workspaces & Turborepo)

```
groww-ai-trading-monolith/
├── apps/
│   ├── api/           # Elysia backend + Better Auth (Vercel Functions / Node)
│   ├── web/           # React + Vite + Tailwind CSS frontend (Vercel Static)
│   └── engine/        # Long-lived trading engine & WebSocket feeds (VPS / Docker)
├── packages/
│   ├── strategy-core/ # Pure quantitative strategy & backtest engine (zero deps)
│   └── shared/        # Multi-broker adapters, types, constants, timezone & session clocks
├── docs/              # Master documentation, sprint plans & regulatory guides
├── turbo.json         # Turborepo task orchestrator
├── package.json       # Root workspace config
├── tsconfig.json      # Base TypeScript configuration
└── CLAUDE.md          # Architectural rules & safety invariants
```

## Documentation

- [Algo Trading Guide](docs/guides/algo-trading-guide.md) — Comprehensive backtest to live bot guide
- [Production Deployment & Pre-Live Checklist](docs/deployment/production-checklist.md) — Pre-live gates & NSE regulatory checklist
- [System Architecture](docs/architecture.md) — Monorepo services, data flow, and database models
- [Strategy Specification](docs/strategy-docs-v2.md) — 9/21 EMA crossover options strategy specification
- [Project Plan](docs/project-plan.md) — Multi-sprint roadmap and deliverables
- [Sprint 19 Hardening](docs/progress/sprints/sprint-19.md) — Live trading safety, Operator 2FA & durable state
- [Gaps Analysis](docs/gaps.md) — Full audit of all known gaps (Critical / Important / Nice-to-have)
- [Implementation Plan](docs/implementation-plan.md) — 3-phase plan to close all gaps (Sprints 20–24+)
- [Trader Platform Roadmap](docs/trader-platform-roadmap.md) — Complete trader ecosystem architecture & specs
- [n8n & Remaining Phases Plan](docs/n8n-and-next-phases-plan.md) — n8n boundary decision & Phase 1/2 specs
- [Final Audit Verdict](docs/audit-verdict.md) — Subsystem scorecard, remaining gaps & recommended enhancements

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) >= 1.1.0
- PostgreSQL (Neon serverless or local Postgres)
- Groww API credentials (with TOTP) and/or Upstox API credentials (`UPSTOX_ANALYTICS_TOKEN` / `UPSTOX_ACCESS_TOKEN`)

### Setup

```bash
# Clone and enter workspace
git clone https://github.com/CVSCharan/ai-trading-monolith.git
cd ai-trading-monolith

# Install all workspace dependencies
bun install

# Setup environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, BETTER_AUTH_SECRET, ENCRYPTION_MASTER_KEY, etc.

# Database migrations & on-demand seeding
bun run db:seed    # Seeds default instruments, strategy templates & cost models
# bun run db:reset # Resets & re-seeds DB (safe in development)

# Start all microservices in watch mode (Web :5173, API :3000, Engine :3001)
bun run dev
```

### Monorepo CLI Commands

```bash
# Run unit tests across all packages
bun test

# Typecheck all 5 workspace packages via Turborepo
bun run typecheck

# Build all packages for production
bun run build

# Standalone database management
bun run db:seed   # Seed default database fixtures
bun run db:reset  # Truncate tables and re-seed (guarded by ALLOW_PROD_RESET)
```

## Strategy, Intelligence & Risk Architecture

**Multi-Strategy Quantitative Engine (`INDEX_OPTIONS` & `EQUITY_CASH`)**
- **Strategies**: `EMA_9_21` Crossover, Opening Range Breakout (`ORB_BREAKOUT`), `VWAP_PULLBACK`, and `RSI_MEAN_REVERSION`.
- **Timeframes**: 5m, 15m, 30m (resampled from 1m ticks, aligned to 09:15 IST).
- **Execution Windows**: Configurable entry window (09:30–11:30 IST).
- **Square-Off Invariant**: Mandatory unconditional square-off at **15:00 IST**.
- **Execution Modes**: Deep ITM Buy (`DEEP_ITM_BUY`), ATM Buy (`ATM_BUY`), ATM Sell (`ATM_SELL`), plus Cash Equity (`EQUITY_CASH`).
- **Pre-Trade Risk Checks**: Daily loss threshold, position limits, per-trade option stop-loss, and lot bounds.
- **Kill Switch**: Disarm-first emergency stop with bounded marketable limit order cleanup (`EMERGENCY_LIMIT_BUFFER_PCT`).

**Trader Ecosystem Modules**
- **Market Pulse & AI (`/pulse`)**: Scheduled RSS + NSE India VIX / FII-DII ingestion (`08:30 IST`, `30m` intraday, `15:35 IST` EOD scorecard) with AI/deterministic sentiment & regime classification.
- **Zero-to-Trader Academy (`/academy`)**: 6-module progressive trading curriculum with DB-persisted progress & interactive quizzes.
- **Watchlist & Price Alerts**: Live LTP quotes and `ABOVE`/`BELOW` price alerts per pinned symbol.
- **Trade Auditor & Journal (`/trade-auditor`)**: Trade-by-trade candlestick inspection with setup, emotion, and rule-adherence journaling.

## Security & Regulatory Compliance

- **Decoupled Database Seeding**: Server startup never unconditionally overwrites database state; seeding is strictly on-demand.
- **Operator 2FA Step-Up (`S19-005`)**: Live trading activation strictly requires an RFC 6238 TOTP verification code from an authenticator app (Google Authenticator, Authy, 1Password), verified against encrypted master-key records in PostgreSQL.
- **Durable Live Audit Trail (`S19-009`)**: Every live order is recorded in `live_fills` with deterministic UUID idempotency keys, and open positions are tracked in `live_positions`.
- **Startup Reconciliation (`S19-010`)**: Multi-broker position state is reconciled and hydrated from PostgreSQL before market data feeds and schedulers start.
- **NSE Circular INSP77559 (`S19-012`)**: Mandates pre-registered Static IPs for automated retail orders, algo order tagging (`X-Algo-Name`, `tag: ai_trader_algo`), and prohibition of naked market orders.
- **Envelope Encryption**: Broker credentials and 2FA secrets encrypted at rest via AES-256-GCM.
- **Live Trading Safety Invariant**: Live capital deployment remains strictly locked (`ENABLE_LIVE_TRADING=false`) until all regulatory and broker-integration requirements pass.

## License

Private — Internal Use Only
