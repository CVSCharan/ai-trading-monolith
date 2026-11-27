# AI Trader Engine

Long-lived quantitative trading engine for paper and live algorithmic execution. Runs on a dedicated VPS/Docker host with registered Static IP for broker API access (Groww & Upstox).

## Tech Stack

- **Runtime**: Bun >= 1.1.0
- **Framework**: Elysia (for health checks, `/ready` probe, metrics)
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Market Data**: Upstox Market Data Feed (WebSocket) + Groww WebSocket + BrokerRouter
- **Persistence**: Durable `live_fills` & `live_positions` with deterministic UUID idempotency
- **Encryption**: Envelope encryption (AES-256-GCM)

## Documentation

- [Algo Trading Guide](../../docs/guides/algo-trading-guide.md)
- [Production Deployment & Pre-Live Checklist](../../docs/deployment/production-checklist.md)
- [Architecture](../../docs/architecture.md)
- [Sprint 19 Progress](../../docs/progress/sprints/sprint-19.md)

## Quick Start

```bash
# Setup environment
cp ../../.env.example .env
# Edit .env with your credentials

# Development
bun run dev

# Build
bun run build

# Start (Production)
bun run start

# Test & Typecheck
bun test
bun run typecheck
```

## Key Architectural Invariants

1. **Startup Reconciliation Sequence**: Multi-broker position state is reconciled and hydrated from PostgreSQL *before* starting market data feeds, schedulers, and command pollers.
2. **Durable Persistence**: All live orders are persisted in `live_fills` and positions in `live_positions`. No critical state is lost on restart.
3. **NSE Retail Algo Regulation (INSP77559)**: All orders attach `X-Algo-Name` header (`AI_TRADER_921_EMA`) and `tag: 'ai_trader_algo'`. Marketable limit orders with tick-rounded price protection buffers are mandatory; naked market orders are blocked.
4. **Kill Switch**: Disarm-first emergency stop with bounded limit square-offs (`EMERGENCY_LIMIT_BUFFER_PCT`).
5. **Fail-Closed Live Guard**: Capital deployment is strictly locked unless `ENABLE_LIVE_TRADING=true`.
