# CLAUDE.md - API Package (Vercel Functions)

## Purpose
Backend API for: auth, strategies, backtest, trade auditor, market data reads.
**Does NOT run** paper/live trading engine (that's `apps/engine`).

## Deployment
- Platform: Vercel Functions (Hobby plan compatible)
- Root Directory: `apps/api`
- Build: `bun run build`
- Max Duration: 300s (5 min)

## Rules

### Auth
- Better Auth manages `user`, `session`, `account` tables
- API wraps Better Auth routes + adds custom endpoints
- 2FA required for live trading enable

### Database
- Drizzle ORM with Neon PostgreSQL
- Use pooled connection string for serverless
- Migrations in `src/db/migrations/`

### API Endpoints (Phase 1)
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/2fa/enable
POST   /api/auth/2fa/verify
GET    /api/auth/me

POST   /api/groww/connect
GET    /api/groww/status
POST   /api/groww/sync
GET    /api/groww/profile
GET    /api/groww/funds

GET    /api/strategies
POST   /api/strategies
GET    /api/strategies/:id
PATCH  /api/strategies/:id
DELETE /api/strategies/:id

POST   /api/backtest/run
GET    /api/backtest/runs
GET    /api/backtest/runs/:id
GET    /api/backtest/runs/:id/trades
GET    /api/backtest/runs/:id/equity

GET    /api/trades/:id/chart-data
GET    /api/trades/:id/context
GET    /api/trades/:id/adjacent

GET    /api/market/candles/:symbol
GET    /api/market/option-chain/:symbol
```

### Engine Commands (via Postgres)
- API writes to `engine_commands` table
- Engine polls and writes to `engine_state`
- Dashboard reads `engine_state` for real-time updates

### Security
- Groww credentials encrypted at rest (envelope encryption)
- TOTP secret never logged
- Rate limiting: auth=10/min, market=100/min, backtest=5/min
- No Groww credentials on Vercel (engine only)

### Cost Config
- Single source: `cost_configs` table (dated)
- No COST_* env vars in production

## Files
```
src/
├── routes/              # API route handlers
├── services/            # Business logic
├── db/                  # Schema, migrations, seed
├── middleware/          # Auth, rate limit, audit
└── index.ts             # Elysia app entry
```

## Commands
```bash
bun run dev          # Dev with --watch
bun run build        # Build to dist/
bun run test         # Tests
bun run typecheck    # Type check
bun run db:studio    # Drizzle Studio
```