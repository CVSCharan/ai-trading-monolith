# 🚀 Sprint 6 — Live Trading + Production Hardening

> **Start**: 2027-01-05 IST  
> **Target End**: 2027-01-11 IST (7 days)  
> **Status**: ⏳ QUEUED  
> **GATE**: ≥ 100 paper trades · PF > 1.5 · Max DD < 10% · 2FA verified

---

## ⛔ Gate Requirements (all must be met before Sprint 6 begins)

| Check | Requirement | Status |
|-------|-------------|--------|
| Paper trade count | ≥ 100 trades logged | ⏳ |
| Profit factor | > 1.5 | ⏳ |
| Max drawdown | < 10% | ⏳ |
| 2FA | Configured and tested | ⏳ |
| Admin approval | `live_trading_enabled = true` in DB | ⏳ |
| Groww credentials | Valid, non-expired token | ⏳ |

---

## Sprint Checklist

- [ ] Live order placed and filled correctly in Groww paper (or test) account
- [ ] Emergency stop tested (open 1 lot → trigger stop → verify closed)
- [ ] Idempotency: submit same order twice → only 1 real order placed
- [ ] Reconciliation recovers correctly after engine restart
- [ ] No plaintext credentials anywhere in logs or DB
- [ ] Deployment smoke test: all 3 apps (web, api, engine) running

---

## Tickets

### S6-001 — Live Trading Gate Check {#S6-001}
| **ETA** | 2027-01-05 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

```typescript
// POST /api/live/enable — 6 prerequisites:
await checkPaperTradeCount(userId)      // ≥ 100
await checkPaperProfitFactor(userId)    // > 1.5
await checkPaperMaxDrawdown(userId)     // < 10%
await check2FAVerified(userId, token)   // 2FA in this session
await checkLiveTradingApproved(userId)  // admin flag
await checkGrowwCredentials(userId)     // valid + non-expired
```

### S6-002 — live-engine.ts: placeOrder {#S6-002}
| **ETA** | 2027-01-05 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Market order for entry. Limit order for exit (30s timeout → market fallback). All 5 risk checks server-side before every order. WebSocket order status from Groww.

### S6-003 — 15:00 Unconditional Square-Off {#S6-003}
| **ETA** | 2027-01-06 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Highest priority action. Market order. No crossover check. Fires even if other logic blocks.

### S6-004 — Idempotency Key {#S6-004}
| **ETA** | 2027-01-06 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Generate idempotency key BEFORE API call (store in DB first). On retry: check if order already exists. Never double-place.

### S6-005 — Partial Fill Tracking {#S6-005}
| **ETA** | 2027-01-07 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Track `filled_quantity` and `avg_fill_price` from Groww WebSocket updates.

### S6-006 — emergency-stop.ts CLI {#S6-006}
| **ETA** | 2027-01-07 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

```bash
bun run emergency-stop --user=<userId> --reason="market crash"
```

Sends command to engine via DB (bypasses WebSocket — works even if WS is down). Cancels all orders → closes all positions → disables live mode → sends email alert.

### S6-007 — Dockerfile {#S6-007}
| **ETA** | 2027-01-08 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Bun base image. `apps/engine` app. Systemd service config for auto-restart. Health check endpoint.

### S6-008 — Vercel Deploy Config {#S6-008}
| **ETA** | 2027-01-08 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

`apps/web/vercel.json` (static export). `apps/api/vercel.json` (Vercel Functions, verify existing). Environment variable checklist for Vercel + VPS.

### S6-009 — Pino Structured Logging {#S6-009}
| **ETA** | 2027-01-09 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

JSON logs to stdout → Vercel log drains / VPS log aggregation. All 3 apps use same pino config from `@groww-trading/shared`.

### S6-010 — Alerting {#S6-010}
| **ETA** | 2027-01-09 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Email on live trading error. Email when daily loss > 1.5%. Engine health dashboard endpoint: `GET /api/engine/health`.

### S6-011 — Pre-Live Validation Checklist {#S6-011}
| **ETA** | 2027-01-10 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

```
Pre-Paper:
  [ ] EMA values match TradingView for identical data
  [ ] Resampling bars align to 09:15 for all timeframes
  [ ] Backtest on 1-year NIFTY data completes < 5 seconds
  [ ] Zero test failures in strategy-core

Pre-Live:
  [ ] 100+ paper trades with verified positive metrics
  [ ] Emergency stop tested (place 1 lot → trigger → verify closed)
  [ ] Idempotency: submit same order twice → 1 real order
  [ ] Token refresh works at market open
  [ ] Reconciliation recovers after engine restart
  [ ] No plaintext credentials in logs or DB
```

### S6-012 — Final Deploy + Smoke Test {#S6-012}
| **ETA** | 2027-01-11 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Deploy all 3 apps. Run smoke test script. Verify real-time WS connection from production frontend to production API. Confirm engine connecting to production DB.

---

*Sprint 6 · Target: 2027-01-11 · 12 tickets*
