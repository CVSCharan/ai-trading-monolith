# 🌐 Sprint 3 — API Routes + WebSocket

> **Start**: 2026-12-08 IST  
> **Target End**: 2026-12-14 IST (7 days)  
> **Status**: ⏳ QUEUED  
> **Gate from Sprint 2**: ≥ 90% coverage, backtest runs  
> **Gate to Sprint 4**: All endpoints return correct status codes; WS connects

---

## Goal

Full REST API with Zod-validated bodies, rate limiting, auth, and a live WebSocket feed.

---

## Sprint Checklist

- [ ] All endpoints return correct HTTP status codes and Zod-validated bodies
- [ ] Rate limiting fires correctly on auth endpoints (10 req/min)
- [ ] WebSocket connects, subscribes, receives market tick
- [ ] Swagger/OpenAPI docs auto-generated at `/api-docs`
- [ ] `bun run typecheck` zero errors

---

## Tickets

### S3-001 — auth-middleware.ts {#S3-001}
| **ETA** | 2026-12-08 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Verify Better Auth session, attach `userId` to Elysia context. 401 on missing/invalid session.

### S3-002 — rate-limit-middleware.ts {#S3-002}
| **ETA** | 2026-12-08 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Upstash Redis sliding window. 10 req/min on auth endpoints, 100 req/min on data endpoints.

### S3-003 — audit-middleware.ts {#S3-003}
| **ETA** | 2026-12-09 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Auto-log financial actions (order placement, strategy change, credential update) to `audit_logs`. INSERT-only.

### S3-004 — risk-middleware.ts {#S3-004}
| **ETA** | 2026-12-09 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Pre-order validation: daily loss limit, max positions, margin check, trading hours, live mode gate.

### S3-005 — routes/groww.ts {#S3-005}
| **ETA** | 2026-12-10 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

```
POST /api/groww/connect   — Zod validate, AES-GCM encrypt, store credentials
GET  /api/groww/status    — check token validity
POST /api/groww/sync      — TOTP refresh
GET  /api/groww/funds     — balance via GrowwClient
GET  /api/groww/positions — positions via GrowwClient
```

### S3-006 — routes/strategy.ts {#S3-006}
| **ETA** | 2026-12-10 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Full CRUD + clone endpoint. Owner-only access via `userId` check.

### S3-007 — routes/backtest.ts {#S3-007}
| **ETA** | 2026-12-11 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

```
POST /api/backtest/run           — enqueue job, return { runId }
GET  /api/backtest/runs/:id      — poll status + results
GET  /api/backtest/runs/:id/trades — paginated
GET  /api/backtest/runs/:id/equity — equity curve
```

### S3-008 — routes/market-data.ts {#S3-008}
| **ETA** | 2026-12-11 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Candles (from DB), option chain (Groww + Redis cache 5s), latest quote.

### S3-009 — routes/paper-trading.ts {#S3-009}
| **ETA** | 2026-12-12 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Start/stop, portfolio, positions, trade history. Commands go to engine via DB.

### S3-010 — routes/live-trading.ts {#S3-010}
| **ETA** | 2026-12-12 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

```
POST /api/live/enable           — 2FA + all 6 prerequisite checks
POST /api/live/emergency-stop   — immediate all-close
GET  /api/live/orders, /api/live/positions
```

### S3-011 — routes/trade.ts {#S3-011}
| **ETA** | 2026-12-13 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Trade auditor: chart data (1m ± 30min + EMAs), option chain snapshot at fill, greeks, prev/next trade nav.

### S3-012 — WebSocket Manager {#S3-012}
| **ETA** | 2026-12-13 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

```
Client → authenticate via JWT query param
       → subscribe to: ticks | candles | signals | paper_updates | live_updates
Engine → PostgreSQL NOTIFY → API → broadcast to subscribed clients
```

Subscription registry: `Map<userId, Set<channelId>>`.

### S3-013 — Backtest Job Queue {#S3-013}
| **ETA** | 2026-12-14 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

`backtest_queue` Postgres table. API inserts job, returns `{ runId, status: 'queued' }`. Background worker: max 2 concurrent. SSE push on completion.

### S3-014 — Sprint 3 Verification {#S3-014}
| **ETA** | 2026-12-14 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Run full checklist. Manual test all endpoints with curl/Postman.

---

*Sprint 3 · Target: 2026-12-14 · 14 tickets*
