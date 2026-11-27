# AI Trader API

Backend API microservice for AI Trader (Multi-Broker Options & Algorithmic Terminal).

## Tech Stack

- **Runtime**: Bun >= 1.1.0
- **Framework**: Elysia (Type-safe, fast, WebSocket native)
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Auth**: Better Auth (Email/password + Operator RFC 6238 TOTP 2FA)
- **Encryption**: Envelope encryption (AES-256-GCM) for broker secrets & 2FA keys
- **Market Data**: Multi-Broker (Groww & Upstox REST + WebSockets)

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

# Database
bun run db:generate   # Generate migrations
bun run db:migrate    # Run migrations
bun run db:seed       # Seed default fixtures (on-demand)
# bun run db:reset    # Reset and re-seed tables

# Development
bun run dev

# Build
bun run build

# Test & Typecheck
bun test
bun run typecheck
```

## Security

- Operator 2FA TOTP verification required for live trading enablement (`POST /api/live/enable`).
- Disarm-first emergency stop with asynchronous acknowledgement (`POST /api/live/emergency-stop`).
- AES-256-GCM envelope encryption for all credentials and operator secrets.
- Server-side pre-trade risk limit validation.
