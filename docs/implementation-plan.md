# Implementation Plan — Gaps Resolution
> **Source:** `docs/gaps.md` audit (2026-11-28)  
> **Strategy:** Ship in 3 phases — Critical Safety (Phase 1), Production Hardening (Phase 2), Future Quality (Phase 3)  
> **Stack:** Bun + Elysia + Drizzle ORM + PostgreSQL (Neon) + Turborepo

---

## Phase Overview

```
Phase 1 · Critical Safety        (Sprints 20–21, ~2 weeks)
  └── GAP-03 DB transactions      Day 1–2
  └── GAP-02 Audit RLS migration  Day 2–3
  └── GAP-05 Option stop-loss     Day 3–7
  └── GAP-04 Remove any types     Day 7–9
  └── GAP-01 Redis rate limiter   Day 9–12

Phase 2 · Production Hardening   (Sprints 22–24, ~3 weeks)
  └── GAP-08 Lint in CI           Day 1
  └── GAP-09 Dockerfile (api)     Day 2–3
  └── GAP-10 Dockerfile (engine)  Day 3–4
  └── GAP-13 Health upsert        Day 4
  └── GAP-12 publishState impl    Day 5–7
  └── GAP-11 Instrument sync      Day 7–10
  └── GAP-15 2FA rate limits      Day 10
  └── GAP-14 Upstox creds in DB   Day 10–14
  └── GAP-07 Integration tests    Day 14–21

Phase 3 · Future Quality         (Post sprint 24, ongoing)
  └── GAP-06 Table partitioning
  └── GAP-05 Walk-forward backtest
  └── GAP-16 Volatility position sizing
  └── GAP-19 WS auth hardening
  └── GAP-20 Candle sanitization
  └── GAP-18 decisions.md
  └── GAP-21 Architecture doc refresh
  └── GAP-22 JWT secret enforcement
```

---

## Phase 1 — Critical Safety (Must complete before any live capital)

### Sprint 20 · Data Integrity & Security Foundations

---

#### TASK-P1-01 — Wrap order + position inserts in DB transactions (GAP-03)
**Files:** `apps/engine/src/services/live-trading.ts`  
**Effort:** ~4 hours  
**Branch:** `fix/p1-01-db-transactions`

**Step-by-step:**

1. Import the Drizzle transaction helper at the top of `live-trading.ts`:
   ```typescript
   import { db } from '../../db'; // typed PostgresJsDatabase
   ```

2. In `placeOrder()` — the entry path (lines ~388–414), replace the two sequential inserts with a transaction:
   ```typescript
   await this.db.transaction(async (tx) => {
     await tx.insert(liveFills).values({ ...fillValues });
     await tx.insert(livePositions).values({ ...posValues });
   });
   ```

3. Apply the same transaction wrapper to:
   - Reversal close + entry inserts (lines ~288–313)
   - `squareOffAll()` fill record insert (lines ~605–622)
   - Exit order persistence in `handleOrderUpdate()` (lines ~479–508)

4. Update the `constructor` signature to accept `PostgresJsDatabase` (not `any`) — this unblocks GAP-04 for this file.

5. Write a unit test simulating a crash between inserts — verify rollback leaves both tables clean.

**Definition of Done:**  
- [ ] All 4 order write sites use `db.transaction()`  
- [ ] TypeScript `any` removed from `db` parameter  
- [ ] `bun run typecheck` passes  
- [ ] Existing tests pass

---

#### TASK-P1-02 — Add Audit Log RLS Migration (GAP-02)
**Files:** `apps/api/src/db/migrations/0003_audit_log_rls.sql`  
**Effort:** ~2 hours  
**Branch:** `fix/p1-02-audit-rls`

**Step-by-step:**

1. Create `apps/api/src/db/migrations/0003_audit_log_rls.sql`:
   ```sql
   -- Make audit_logs append-only at the database level
   -- The application role (used by the API and engine) may INSERT but never UPDATE or DELETE.
   
   ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
   
   -- Block all UPDATE and DELETE from all roles (including superuser unless BYPASSRLS)
   CREATE POLICY audit_no_mutation
     ON audit_logs
     AS RESTRICTIVE
     FOR ALL
     USING (true)       -- SELECT is allowed
     WITH CHECK (true); -- INSERT is allowed
   
   -- Now individually restrict UPDATE and DELETE
   CREATE POLICY audit_no_update
     ON audit_logs
     AS RESTRICTIVE
     FOR UPDATE
     USING (false);
   
   CREATE POLICY audit_no_delete
     ON audit_logs
     AS RESTRICTIVE
     FOR DELETE
     USING (false);
   
   -- Comment for future maintainers
   COMMENT ON TABLE audit_logs IS 
     'Append-only audit trail. RLS enforced. UPDATE and DELETE blocked at DB level.';
   ```

2. Register in `drizzle.config.ts` or run via `bun run db:migrate`.

3. Verify with `psql`:
   ```sql
   -- Should succeed:
   INSERT INTO audit_logs (action, entity_type, created_at) VALUES ('TEST', 'test', NOW());
   
   -- Should fail with RLS error:
   DELETE FROM audit_logs WHERE action = 'TEST';
   UPDATE audit_logs SET action = 'TAMPERED' WHERE action = 'TEST';
   ```

4. Confirm application `logAuditEvent()` still works after migration.

**Definition of Done:**  
- [ ] Migration file created and committed  
- [ ] `bun run db:migrate` succeeds on staging DB  
- [ ] DELETE and UPDATE fail with RLS policy error  
- [ ] INSERT via application code succeeds

---

#### TASK-P1-03 — Implement Per-Trade Option Premium Stop-Loss (GAP-05)
**Files:**  
- `packages/shared/src/types.ts`  
- `packages/strategy-core/src/signals/generator.ts`  
- `apps/api/src/db/schema.ts`  
- `packages/strategy-core/test/generator.test.ts`

**Effort:** ~2–3 days  
**Branch:** `feat/p1-03-option-stoploss`

**Step-by-step:**

1. **Extend `StrategyConfig` type** in `packages/shared/src/types.ts`:
   ```typescript
   export interface StrategyConfig {
     // ... existing fields ...
     stopLossPct?: number; // e.g., 50 = exit when option premium drops 50% from entry
   }
   ```

2. **Extend `exitReasonEnum`** in `apps/api/src/db/schema.ts`:
   ```typescript
   export const exitReasonEnum = pgEnum('exit_reason', [
     'OPPOSITE_CROSSOVER',
     'SQUARE_OFF_1500',
     'REVERSAL',
     'DAILY_LOSS_LIMIT',
     'MARGIN_CALL',
     'MANUAL',
     'STOP_LOSS_SHORT',
     'STOP_LOSS_LONG',   // ← new
   ]);
   ```
   Add migration `0004_exit_reason_stop_loss_long.sql`.

3. **Track entry price in `StreamingSignalGenerator`** in `packages/strategy-core/src/signals/generator.ts`:
   ```typescript
   // Add to the generator state:
   private entryPrice: number | null = null;
   private stopLossPct: number;

   constructor(config: StrategyConfig, instruments: Instrument[], runType: RunType) {
     this.stopLossPct = config.stopLossPct ?? 50; // default 50%
     // ...
   }
   ```

4. **In `processBar()`**, after checking for 15:00 square-off and before entry window check, add the stop-loss check:
   ```typescript
   // Stop-loss check for long positions (before entry window check)
   if (this.openPosition?.side === 'LONG' && currentOptionPrice !== undefined) {
     if (this.entryPrice !== null) {
       const premiumDropPct = ((this.entryPrice - currentOptionPrice) / this.entryPrice) * 100;
       if (premiumDropPct >= this.stopLossPct) {
         // Emit exit signal
         signals.push(this.buildExitSignal(bar, 'STOP_LOSS_LONG', currentOptionPrice));
         this.openPosition = null;
         this.entryPrice = null;
       }
     }
   }
   ```

5. **Wire `currentOptionPrice`** into `processBar()` — this requires the caller to supply the current option LTP. In live/paper mode this comes from the tick cache; in backtest mode use the `optionPriceLookup` function.

6. **Update the backtest engine** `packages/strategy-core/src/backtest/engine.ts` to pass current option price to `processBar()` on each bar and handle `STOP_LOSS_LONG` exit reason.

7. **Write unit tests:**
   ```typescript
   // test: stop loss triggers at 50% premium drop
   it('should exit LONG when premium drops 50%', () => {
     // Entry bar: EMA crossover, entry at 200
     // Next bars: price decays to 95 (52.5% drop)
     // Expected: SELL signal emitted with exitReason = STOP_LOSS_LONG
   });
   ```

8. **Update strategy builder UI** `apps/web/src/pages/StrategyBuilderPage.tsx` to expose a "Stop Loss %" input field.

**Definition of Done:**  
- [ ] `stopLossPct` in `StrategyConfig`, `BacktestConfig`, `Strategy` table schema  
- [ ] `STOP_LOSS_LONG` in enum + migration  
- [ ] Generator emits stop-loss signals correctly  
- [ ] Backtest processes stop-loss correctly  
- [ ] Unit tests pass  
- [ ] UI field wired up

---

#### TASK-P1-04 — Remove `any` Types from Engine Core (GAP-04)
**Files:** `apps/engine/src/services/live-trading.ts`, `apps/engine/src/index.ts`  
**Effort:** ~1 day  
**Branch:** `fix/p1-04-remove-any-types`

**Step-by-step:**

1. Import the Drizzle db type in engine:
   ```typescript
   import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
   import type * as schema from '../../../api/src/db/schema';
   
   type DB = PostgresJsDatabase<typeof schema>;
   ```

2. Replace `private db: any` with `private db: DB` in `LiveTradingEngine`, `PaperTradingEngine`, `CommandProcessor`, `ReconciliationService`.

3. In `engine/src/index.ts`, type the session generators map:
   ```typescript
   import type { StreamingSignalGenerator } from '@groww-trading/strategy-core';
   import type { Instrument } from '@groww-trading/shared';
   
   interface GeneratorEntry {
     generator: StreamingSignalGenerator;
     strategy: Strategy;
     instruments: Instrument[];
   }
   
   const paperGenerators = session.paper?.generators as Map<string, GeneratorEntry> | undefined;
   ```

4. Run `bun run typecheck` and fix all resulting type errors.

**Definition of Done:**  
- [ ] Zero `any` occurrences in `apps/engine/src/**` (verify with `grep -r ": any" apps/engine/src`)  
- [ ] `bun run typecheck` passes  
- [ ] All tests pass

---

#### TASK-P1-05 — Replace In-Memory Rate Limiter with Redis (GAP-01)
**Files:**  
- `apps/api/src/middleware/rate-limit-middleware.ts`  
- `apps/api/package.json` (add `@upstash/redis`)  
- `apps/api/src/config.ts`  
- `.env.example`

**Effort:** ~1 day  
**Branch:** `feat/p1-05-redis-rate-limiter`

**Step-by-step:**

1. Install Upstash Redis SDK:
   ```bash
   bun add @upstash/redis --filter @groww-trading/api
   ```

2. Add Redis config to `apps/api/src/config.ts`:
   ```typescript
   UPSTASH_REDIS_REST_URL: z.string().url().optional(),
   UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
   ```

3. Rewrite `rate-limit-middleware.ts` to use Redis sorted set sliding window:
   ```typescript
   import { Redis } from '@upstash/redis';

   export class RedisRateLimiter {
     private redis: Redis | null;

     constructor(redisUrl?: string, redisToken?: string) {
       this.redis = redisUrl && redisToken
         ? new Redis({ url: redisUrl, token: redisToken })
         : null; // falls back to in-memory in dev
     }

     async check(key: string, maxRequests: number, windowMs: number) {
       if (!this.redis) return this.inMemoryCheck(key, maxRequests, windowMs);

       const now = Date.now();
       const windowStart = now - windowMs;
       const redisKey = `rl:${key}`;

       // Sliding window using sorted set
       const pipe = this.redis.pipeline();
       pipe.zremrangebyscore(redisKey, 0, windowStart); // remove old entries
       pipe.zadd(redisKey, { score: now, member: `${now}` }); // add current
       pipe.zcard(redisKey); // count in window
       pipe.expire(redisKey, Math.ceil(windowMs / 1000) + 1);
       const results = await pipe.exec();
       const count = results[2] as number;

       return {
         allowed: count <= maxRequests,
         remaining: Math.max(0, maxRequests - count),
         retryAfterSec: count > maxRequests ? Math.ceil(windowMs / 1000) : 0,
       };
     }
   }
   ```

4. Fallback to in-memory in development when `UPSTASH_REDIS_REST_URL` is not set.

5. Add to `.env.example`:
   ```
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token
   ```

6. Update `createRateLimitPlugin()` to use the new `async` checker.

**Definition of Done:**  
- [ ] Redis limiter used in production  
- [ ] Graceful fallback to in-memory in dev  
- [ ] Integration test: 11 requests within window → 429 on the 11th  
- [ ] State survives process restart (verified manually)

---

### Sprint 21 — Complete Phase 1

**Sprint 21 goal:** Verify all Phase 1 tasks on staging before enabling live trading flag.

| Task | Days | Owner |
|------|------|-------|
| TASK-P1-01 (transactions) | Day 1–2 | Backend |
| TASK-P1-02 (audit RLS) | Day 2 | Backend |
| TASK-P1-03 (stop-loss) | Day 3–7 | Full-stack |
| TASK-P1-04 (remove any) | Day 7–8 | Backend |
| TASK-P1-05 (redis) | Day 9–10 | Backend |
| Staging deploy + smoke test | Day 11–12 | All |
| Phase 1 sign-off | Day 13–14 | Lead |

---

## Phase 2 — Production Hardening (3 weeks)

### Sprint 22 · CI, Containers, and Health

---

#### TASK-P2-01 — Add Lint Job to CI (GAP-08)
**Files:** `.github/workflows/ci.yml`  
**Effort:** ~30 minutes  

```yaml
# Add this job to ci.yml:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    needs: [install-and-typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.1.0
      - name: Install dependencies
        run: bun install --frozen-lockfile
      - name: Lint
        run: bun run lint

# Update build job:
  build:
    needs: [install-and-typecheck, lint, test]  # ← add lint
```

---

#### TASK-P2-02 — Harden API Dockerfile (GAP-09)
**Files:** `apps/api/Dockerfile`  
**Effort:** ~2 hours  

```dockerfile
# syntax=docker/dockerfile:1

# --- Stage 1: Build ---
FROM oven/bun:1.3-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY packages/strategy-core/package.json packages/strategy-core/
COPY apps/api/package.json apps/api/

RUN bun install --frozen-lockfile --ignore-scripts

COPY packages/shared packages/shared
COPY packages/strategy-core packages/strategy-core
COPY apps/api apps/api

RUN bun run build --filter=@groww-trading/api

# --- Stage 2: Run ---
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

COPY --from=builder --chown=appuser:appgroup /app/apps/api/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

USER appuser

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["bun", "run", "dist/index.js"]
```

---

#### TASK-P2-03 — Create Engine Dockerfile (GAP-10)
**Files:** `apps/engine/Dockerfile` (new), `docker-compose.yml` (new at root)  
**Effort:** ~4 hours  

Create `apps/engine/Dockerfile` following the same multi-stage pattern as the API Dockerfile. Add `docker-compose.yml` at root for local development:

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: trading_dev
      POSTGRES_USER: trading
      POSTGRES_PASSWORD: trading_dev_pw
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3000:3000"
    env_file: .env
    depends_on: [postgres]

  engine:
    build:
      context: .
      dockerfile: apps/engine/Dockerfile
    ports:
      - "8001:8001"
    env_file: .env
    depends_on: [postgres, api]

volumes:
  pgdata:
```

---

#### TASK-P2-04 — Fix `engineHealth` to Upsert (GAP-13)
**Files:** `apps/engine/src/index.ts`, migration needed  
**Effort:** ~2 hours  

1. Add migration `0004_engine_health_unique_host.sql`:
   ```sql
   ALTER TABLE engine_health ADD CONSTRAINT engine_health_host_id_unique UNIQUE (host_id);
   ```

2. Replace INSERT with upsert in `publishHeartbeat()`:
   ```typescript
   await db.insert(engineHealth)
     .values(health)
     .onConflictDoUpdate({
       target: engineHealth.hostId,
       set: {
         status: sql`excluded.status`,
         lastCheck: sql`excluded.last_check`,
         metrics: sql`excluded.metrics`,
         activeSessions: sql`excluded.active_sessions`,
         errorsLastHour: sql`excluded.errors_last_hour`,
       },
     });
   ```

3. Add a weekly cleanup cron to delete rows older than 7 days.

---

### Sprint 23 · Instrument Sync, Engine State, and Security

---

#### TASK-P2-05 — Implement Engine State Publishing (GAP-12)
**Files:** `apps/engine/src/index.ts`, `apps/engine/src/services/command-processor.ts`  
**Effort:** ~1 day  

Replace the empty `publishState()` with real aggregation and upsert to `engine_state`:

```typescript
async function publishState() {
  if (isShuttingDown) return;
  try {
    for (const [userId, session] of commandProcessor.getActiveSessions()) {
      const positions = liveEngine.getOpenPositions();
      await db.insert(engineState)
        .values({
          userId,
          runType: session.live ? 'live' : 'paper',
          isRunning: true,
          lastHeartbeat: new Date(),
          currentPositions: JSON.stringify(positions),
          dailyPnl: JSON.stringify({ realized: liveEngine.getDailyPnl() }),
          riskMetrics: JSON.stringify({ openCount: positions.length }),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [engineState.userId, engineState.runType],
          set: { isRunning: true, currentPositions: ..., updatedAt: new Date() },
        });
    }
  } catch (error) {
    logger.error({ err: error }, 'Error publishing state');
  }
}
```

---

#### TASK-P2-06 — Fix Instrument Master Weekly Sync (GAP-11)
**Files:** `apps/engine/src/services/scheduler.ts`  
**Effort:** ~1 day  

Rewrite `syncInstrumentMaster()` to actually parse and upsert the option chain:

```typescript
async syncInstrumentMaster(): Promise<void> {
  for (const underlying of ['NIFTY', 'BANKNIFTY', 'FINNIFTY']) {
    try {
      const chain = await this.growwClient.getOptionChain(underlying, '');
      if (!chain?.payload?.data) continue;

      const rows = parseOptionChainToInstruments(chain.payload.data, underlying);
      
      await this.db.insert(instruments)
        .values(rows)
        .onConflictDoUpdate({
          target: [instruments.symbol, instruments.expiryDate, instruments.strikePrice, instruments.optionType],
          set: {
            lotSize: sql`excluded.lot_size`,
            isActive: sql`excluded.is_active`,
            growwToken: sql`excluded.groww_token`,
          },
        });
      
      this.logger.info({ underlying, count: rows.length }, 'Instrument master synced');
    } catch (err) {
      this.logger.error({ err, underlying }, 'Instrument master sync failed');
    }
  }
}
```

---

#### TASK-P2-07 — Stricter Rate Limits on 2FA & Credential Endpoints (GAP-15)
**Files:** `apps/api/src/routes/auth-extra.ts`, `apps/api/src/routes/groww.ts`  
**Effort:** ~4 hours  

Add a dedicated `tightRateLimit` plugin to the most sensitive routes:

```typescript
const twoFaRateLimit = createRateLimitPlugin({ name: 'two-fa', maxRequests: 3, windowMs: 60_000 });
const credentialRateLimit = createRateLimitPlugin({ name: 'creds', maxRequests: 5, windowMs: 60_000 });

export const authExtraRoutes = new Elysia({ prefix: '/api/auth' })
  .use(twoFaRateLimit) // ← Add this
  .post('/2fa/setup', ...)
  .post('/2fa/verify', ...);
```

---

#### TASK-P2-08 — Upstox Credentials in Encrypted DB Storage (GAP-14)
**Files:** Schema, migration, `apps/engine/src/services/upstox-client.ts`  
**Effort:** ~2 days  

1. Add migration `0005_upstox_credentials.sql` with a table mirroring `groww_credentials`.
2. Add `upstoxCredentials` table to `apps/api/src/db/schema.ts`.
3. Create `POST /api/upstox/connect` route to store encrypted Upstox tokens (mirror of `POST /api/groww/connect`).
4. Update `upstox-client.ts` to load tokens from DB (decrypted at runtime) rather than env vars.
5. Keep env vars as a fallback for backward compatibility.

---

### Sprint 24 · Integration Tests

---

#### TASK-P2-09 — Integration Test Suite (GAP-07)
**Files:** `apps/api/test/integration/`, `apps/engine/test/integration/`  
**Effort:** ~1 week  

**Test infrastructure:**
1. Add `test` PostgreSQL database via Docker Compose or Neon branch.
2. Create `apps/api/test/integration/setup.ts` to run migrations, seed minimal fixtures, and clean between tests.

**Test files to create:**

| File | Coverage |
|------|----------|
| `auth.integration.test.ts` | Register, login, session, logout |
| `strategy.integration.test.ts` | CRUD strategies, clone |
| `backtest.integration.test.ts` | Submit run, poll status, fetch results |
| `paper-trading.integration.test.ts` | Start session, receive signals, check portfolio |
| `live-trading.integration.test.ts` | Gates check, 2FA enable, emergency stop |
| `audit.integration.test.ts` | Confirm audit log written, RLS blocks delete |
| `engine-command.integration.test.ts` | API command → DB → engine processes |

---

## Phase 3 — Future Quality (Post sprint 24)

### TASK-P3-01 — Table Partitioning for Candles (GAP-06)

Convert `candles_1m` and `candles_resampled` to `PARTITION BY RANGE (bar_time)`:

```sql
-- Migration: convert to partitioned table
-- 1. Rename existing table
ALTER TABLE candles_1m RENAME TO candles_1m_legacy;

-- 2. Create partitioned table
CREATE TABLE candles_1m (
  LIKE candles_1m_legacy INCLUDING ALL
) PARTITION BY RANGE (bar_time);

-- 3. Create initial partitions (backfill historical)
CREATE TABLE candles_1m_2024_01 PARTITION OF candles_1m
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- ... one per month ...

-- 4. Copy data
INSERT INTO candles_1m SELECT * FROM candles_1m_legacy;

-- 5. Drop legacy
DROP TABLE candles_1m_legacy;
```

Add a monthly cron at engine level to `CREATE TABLE candles_1m_YYYY_MM PARTITION OF candles_1m FOR VALUES FROM (...) TO (...)` at the start of each month.

---

### TASK-P3-02 — Walk-Forward Backtest Validation (GAP-17)

Add `walkForwardMonths?: number` to `BacktestConfig`. When set, the backtest API slices the date range into rolling windows of `walkForwardMonths` in-sample and 1-month out-of-sample, and returns per-window metrics alongside the full run.

---

### TASK-P3-03 — Volatility-Based Position Sizing (GAP-16)

Wire `perTradeRiskPct` from `risk_limits` JSONB into `StreamingSignalGenerator`. Compute position size as:

```
lots = floor((capital × perTradeRiskPct/100) / (stopLossPct/100 × optionPremium × lotSize))
```

Clamp to `maxLotsPerOrder` and `maxOpenPositions` limits.

---

### TASK-P3-04 — WebSocket Auth Hardening (GAP-19)

Validate the JWT at the WebSocket upgrade handshake before the connection is accepted:

```typescript
// ws-manager.ts
server.on('upgrade', (req, socket, head) => {
  const token = extractToken(req.headers);
  if (!verifyJwt(token)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
```

---

### TASK-P3-05 — Candle Sanitization (GAP-20)

Add a validation layer in `scheduler.ts` before inserting raw candles:

```typescript
function isValidCandle(c: RawCandle): boolean {
  return (
    c.close > 0 &&
    c.open > 0 &&
    c.high >= Math.max(c.open, c.close) &&
    c.low <= Math.min(c.open, c.close) &&
    c.high / c.low < 1.2 && // reject >20% spread (bad tick)
    c.volume >= 0
  );
}
```

---

### TASK-P3-06 — Docs & Config Cleanup (GAP-18, GAP-21, GAP-22)

1. Create `docs/decisions.md` with ADRs for: Elysia vs Fastify, Bun vs Node, Neon vs RDS, Drizzle vs Prisma, Better Auth vs Auth.js.
2. Sync `docs/architecture.md` — remove Redis references, add engine app details, update schema tables.
3. Raise `BETTER_AUTH_SECRET` minimum to 32 chars and remove default:
   ```typescript
   BETTER_AUTH_SECRET: z.string().min(32), // No default — force explicit in all envs
   ```

---

## Tracking Dashboard

| Phase | Gap IDs | Status | Target |
|-------|---------|--------|--------|
| Phase 1 | GAP-01 to GAP-05 | 🔲 Not started | Sprint 21 end |
| Phase 2 | GAP-06 to GAP-15 | 🔲 Not started | Sprint 24 end |
| Phase 3 | GAP-16 to GAP-22 | 🔲 Not started | Post sprint 24 |

> Update the status column to 🟡 In Progress → ✅ Done as tasks are completed.  
> Link each row to the corresponding PR once merged.
