# CLAUDE.md - Groww Trading System

## Project-Wide Rules

### Time & Timezone (CRITICAL)
- **ALL time handling MUST use IST (Asia/Kolkata)**
- Use `packages/shared/src/timezone.ts` helpers exclusively
- Never use `Date.now()`, `new Date()`, `getHours()`, `getMinutes()` without timezone conversion
- Market hours: 09:15 - 15:30 IST
- Resample alignment: 09:15 anchor

### Live Trading Safety (NON-NEGOTIABLE)
- `ENABLE_LIVE_TRADING` defaults to `false`
- Live trading requires explicit user action per session (2FA + API call)
- **All risk limits enforced server-side only** - client cannot bypass
- Emergency stop must work without UI (CLI script + API endpoint)
- Every order requires idempotency key (generated before API call)
- Audit logs: INSERT-only via revoked UPDATE/DELETE privileges + trigger

### Strategy Core Rules
- Pure TypeScript, **zero external dependencies** (only shared package)
- EMA seeding: SMA of first N closes, warmup = NaN
- Signals on CLOSED bars only - no look-ahead bias
- Exits (opposite crossover, 15:00) ALWAYS honored, not gated by entry window
- Entry window gates NEW entries only
- Immediate reversal: only within entry window
- Lot sizes from `instruments` table only (dated validity)
- Cost config from `cost_configs` table (dated)

### Code Quality
- TypeScript strict mode everywhere
- Zod validation at all boundaries
- Tests for all pure functions (strategy-core > 90% coverage)
- No `any` types without justification
- ESLint + Prettier enforced via Husky

### Documentation Status
| Document | Status |
|----------|--------|
| `docs/project-plan.md` | Authoritative |
| `docs/architecture.md` | Draft (needs updates for long-lived process, split trade tables) |
| `docs/strategy-docs-v2.md` | Authoritative (with open issues noted) |
| `docs/phase1-spec.md` | Authoritative for Phase 1 |
| `docs/decisions.md` | Authoritative for architectural decisions |
| `docs/gaps.md` | Authoritative gaps register (`GAP-01`–`GAP-33`) |
| `docs/audit-verdict.md` | Authoritative final audit scorecard & status |
| `docs/trader-platform-roadmap.md` | Authoritative trader ecosystem roadmap |

### Git Workflow
- Single repo, conventional commits
- Feature branches from `main`
- PR required for all changes
- CI must pass (typecheck, lint, test, build)

## Package Structure

```
groww-trading-system/
├── apps/
│   ├── api/              # Elysia backend (Vercel Functions)
│   ├── web/              # React frontend (Vercel Static)
│   └── engine/           # Long-lived trading engine (VPS/Docker)
├── packages/
│   ├── strategy-core/    # Pure strategy logic (depends on shared only)
│   └── shared/           # Types, constants, timezone helpers
├── docs/                 # Master documentation
├── turbo.json            # Turborepo config
├── package.json          # Root workspace
├── tsconfig.json         # Base TypeScript config
└── CLAUDE.md             # This file
```

## Development Commands

```bash
# From root (single install, single lockfile)
bun install              # Install all workspaces
bun run dev              # Start all dev servers (api, web, engine)
bun run build            # Build all packages
bun run test             # Run all tests
bun run typecheck        # Type check all packages
bun run lint             # Lint all packages
bun run format           # Format all files

# Database (API only)
bun run db:generate      # Generate DB migrations
bun run db:migrate       # Run migrations
bun run db:push          # Push schema (dev)
bun run db:studio        # Open Drizzle Studio
bun run db:seed          # Seed instruments
```

## Workspace Dependencies

```json
// apps/api/package.json, apps/web/package.json, apps/engine/package.json
"dependencies": {
  "@groww-trading/shared": "workspace:*",
  "@groww-trading/strategy-core": "workspace:*"
}
```

## Deployment Targets

| App | Platform | Root Directory | Build Command |
|-----|----------|----------------|---------------|
| web | Vercel (Static) | `apps/web` | `bun run build` |
| api | Vercel (Functions) | `apps/api` | `bun run build` |
| engine | VPS/Docker | `apps/engine` | `bun run build` |

## Area-Specific Rules

See `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/engine/CLAUDE.md`, `packages/strategy-core/CLAUDE.md`