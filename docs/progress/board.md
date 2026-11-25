# 🗃️ Kanban Board — Groww AI Trading

> Updated: 2026-11-26 IST  
> Columns: **TODO** · **IN PROGRESS** · **REVIEW/BLOCKED** · **DONE**

---

## 🔵 IN PROGRESS

| Ticket | Title | Sprint | Owner | ETA |
|--------|-------|--------|-------|-----|
| [S0-002](sprints/sprint-immediate.md#S0-002) | Enable GitHub Actions CI | Immediate | @dev | 2026-11-26 |
| [S0-003](sprints/sprint-immediate.md#S0-003) | Verify UTC+EDT matrix passes | Immediate | @dev | 2026-11-26 |
| [S0-004](sprints/sprint-immediate.md#S0-004) | Set branch protection (CI required) | Immediate | @dev | 2026-11-26 |

---

## 📋 TODO — Sprint 1.5 (Nov 26–28)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| *(All Sprint 1.5 coding tickets complete — only `S0-001`..`S0-004` GitHub push + CI remain)* | — | — | — |

---

## 📋 TODO — Sprint 2 (Dec 1–6)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| [S2-004](sprints/sprint-2.md#S2-004) | Implement backtest/engine.ts | 🔴 | 2026-12-03 |
| [S2-005](sprints/sprint-2.md#S2-005) | Implement backtest/metrics.ts (Sharpe, Sortino, DD) | 🟡 | 2026-12-04 |
| [S2-006](sprints/sprint-2.md#S2-006) | Implement backtest/reporter.ts | 🟡 | 2026-12-04 |
| [S2-008](sprints/sprint-2.md#S2-008) | Write backtest.test.ts (6 test cases) | 🔴 | 2026-12-05 |
| [S2-009](sprints/sprint-2.md#S2-009) | Verify ≥90% coverage gate | 🔴 | 2026-12-06 |

---

## 📋 TODO — Sprint 3 (Dec 8–14)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| [S3-001](sprints/sprint-3.md#S3-001) | auth-middleware.ts (Better Auth session) | 🔴 | 2026-12-08 |
| [S3-002](sprints/sprint-3.md#S3-002) | rate-limit-middleware.ts (Upstash sliding window) | 🔴 | 2026-12-08 |
| [S3-003](sprints/sprint-3.md#S3-003) | audit-middleware.ts (auto-log financial actions) | 🔴 | 2026-12-09 |
| [S3-004](sprints/sprint-3.md#S3-004) | risk-middleware.ts (pre-order risk checks) | 🔴 | 2026-12-09 |
| [S3-005](sprints/sprint-3.md#S3-005) | Implement routes/groww.ts (connect/status/sync) | 🔴 | 2026-12-10 |
| [S3-006](sprints/sprint-3.md#S3-006) | Implement routes/strategy.ts (full CRUD) | 🟡 | 2026-12-10 |
| [S3-007](sprints/sprint-3.md#S3-007) | Implement routes/backtest.ts (run + poll) | 🟡 | 2026-12-11 |
| [S3-008](sprints/sprint-3.md#S3-008) | Implement routes/market-data.ts | 🟡 | 2026-12-11 |
| [S3-009](sprints/sprint-3.md#S3-009) | Implement routes/paper-trading.ts | 🟡 | 2026-12-12 |
| [S3-010](sprints/sprint-3.md#S3-010) | Implement routes/live-trading.ts (gated) | 🔴 | 2026-12-12 |
| [S3-011](sprints/sprint-3.md#S3-011) | Implement routes/trade.ts (trade auditor) | 🟡 | 2026-12-13 |
| [S3-012](sprints/sprint-3.md#S3-012) | WebSocket manager + LISTEN/NOTIFY bridge | 🔴 | 2026-12-13 |
| [S3-013](sprints/sprint-3.md#S3-013) | Backtest job queue (Postgres table + worker) | 🟡 | 2026-12-14 |
| [S3-014](sprints/sprint-3.md#S3-014) | Sprint 3 checklist verification | 🔴 | 2026-12-14 |
| [S3-015](sprints/sprint-3.md) | Global error handler + correlation IDs + DB `/health` ping | 🔴 | 2026-12-14 |
| [S3-016](sprints/sprint-3.md) | Graceful shutdown (SIGTERM/SIGINT closing DB pool) in API | 🟡 | 2026-12-14 |

---

## 📋 TODO — Sprint 4 (Dec 15–22)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| [S4-001](sprints/sprint-4.md#S4-001) | Implement loadStrategy() in command-processor.ts | 🔴 | 2026-12-15 |
| [S4-002](sprints/sprint-4.md#S4-002) | Implement loadInstruments() | 🔴 | 2026-12-15 |
| [S4-003](sprints/sprint-4.md#S4-003) | Implement closeAllPaperPositions() | 🔴 | 2026-12-16 |
| [S4-004](sprints/sprint-4.md#S4-004) | Implement closeAllLivePositions() + cancelAllOrders() | 🔴 | 2026-12-16 |
| [S4-005](sprints/sprint-4.md#S4-005) | WebSocketManager with exponential backoff reconnect | 🔴 | 2026-12-17 |
| [S4-006](sprints/sprint-4.md#S4-006) | Backfill missing bars on reconnect | 🔴 | 2026-12-17 |
| [S4-007](sprints/sprint-4.md#S4-007) | paper-engine.ts — real-time tick → bar aggregation | 🔴 | 2026-12-18 |
| [S4-008](sprints/sprint-4.md#S4-008) | paper-engine.ts — risk checks + fill simulation | 🔴 | 2026-12-18 |
| [S4-009](sprints/sprint-4.md#S4-009) | paper-engine.ts — MTM update per tick | 🟡 | 2026-12-19 |
| [S4-010](sprints/sprint-4.md#S4-010) | Scheduler — downloadDayCandles (15:30 IST cron) | 🟡 | 2026-12-19 |
| [S4-011](sprints/sprint-4.md#S4-011) | Scheduler — syncInstrumentMaster (Mon 09:00 IST) | 🟡 | 2026-12-20 |
| [S4-012](sprints/sprint-4.md#S4-012) | DB migration: add closedReason column | 🟡 | 2026-12-20 |
| [S4-013](sprints/sprint-4.md#S4-013) | E2E test: paper session start → signal → position | 🔴 | 2026-12-21 |
| [S4-014](sprints/sprint-4.md#S4-014) | E2E test: emergency stop closes all positions | 🔴 | 2026-12-22 |

---

## 📋 TODO — Sprint 5 (Dec 23–Jan 1)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| [S5-001](sprints/sprint-5.md#S5-001) | Vite + React 18 + TS project init | 🔴 | 2026-12-23 |
| [S5-002](sprints/sprint-5.md#S5-002) | Tailwind + shadcn/ui setup | 🟡 | 2026-12-23 |
| [S5-003](sprints/sprint-5.md#S5-003) | App.tsx router + auth guard | 🔴 | 2026-12-24 |
| [S5-004](sprints/sprint-5.md#S5-004) | Layout.tsx sidebar nav + header | 🟡 | 2026-12-24 |
| [S5-005](sprints/sprint-5.md#S5-005) | AuthPage.tsx (Better Auth) | 🔴 | 2026-12-25 |
| [S5-006](sprints/sprint-5.md#S5-006) | DashboardPage.tsx (equity, PnL, positions) | 🟡 | 2026-12-25 |
| [S5-007](sprints/sprint-5.md#S5-007) | TradeCandlestickChart.tsx (EMA overlay + markers) | 🔴 | 2026-12-26 |
| [S5-008](sprints/sprint-5.md#S5-008) | TradeContextPanel.tsx (option chain, greeks) | 🟡 | 2026-12-27 |
| [S5-009](sprints/sprint-5.md#S5-009) | TradeAuditorPage keyboard nav (←/→) | 🔴 | 2026-12-27 |
| [S5-010](sprints/sprint-5.md#S5-010) | useWebSocket hook + PositionPanel real-time | 🔴 | 2026-12-28 |
| [S5-011](sprints/sprint-5.md#S5-011) | StrategyBuilderPage.tsx | 🟡 | 2026-12-29 |
| [S5-012](sprints/sprint-5.md#S5-012) | BacktestResultsPage.tsx (equity curve + trades) | 🟡 | 2026-12-29 |
| [S5-013](sprints/sprint-5.md#S5-013) | PaperTradingPage.tsx | 🟡 | 2026-12-30 |
| [S5-014](sprints/sprint-5.md#S5-014) | PortfolioBar + SignalFeed components | 🟡 | 2026-12-30 |
| [S5-015](sprints/sprint-5.md#S5-015) | Sprint 5 checklist + mobile responsive audit | 🔴 | 2027-01-01 |

---

## 📋 TODO — Sprint 6 (Jan 5–11)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| [S6-001](sprints/sprint-6.md#S6-001) | Live trading gate prerequisites check | 🔴 | 2027-01-05 |
| [S6-002](sprints/sprint-6.md#S6-002) | live-engine.ts — placeOrder with 5 risk checks | 🔴 | 2027-01-05 |
| [S6-003](sprints/sprint-6.md#S6-003) | live-engine.ts — 15:00 unconditional square-off | 🔴 | 2027-01-06 |
| [S6-004](sprints/sprint-6.md#S6-004) | Idempotency key — generate before API call | 🔴 | 2027-01-06 |
| [S6-005](sprints/sprint-6.md#S6-005) | Partial fill tracking | 🟡 | 2027-01-07 |
| [S6-006](sprints/sprint-6.md#S6-006) | emergency-stop.ts CLI script | 🔴 | 2027-01-07 |
| [S6-007](sprints/sprint-6.md#S6-007) | Dockerfile (Bun base, engine app) | 🟡 | 2027-01-08 |
| [S6-008](sprints/sprint-6.md#S6-008) | Vercel deploy config (web + api) | 🟡 | 2027-01-08 |
| [S6-009](sprints/sprint-6.md#S6-009) | Pino structured logging → Vercel/VPS | 🟡 | 2027-01-09 |
| [S6-010](sprints/sprint-6.md#S6-010) | Alerting: email on live error + daily loss >1.5% | 🔴 | 2027-01-09 |
| [S6-011](sprints/sprint-6.md#S6-011) | Pre-live validation checklist (12 items) | 🔴 | 2027-01-10 |
| [S6-012](sprints/sprint-6.md#S6-012) | Final deployment + smoke test | 🔴 | 2027-01-11 |
| [S6-013](sprints/sprint-6.md) | Process crash handlers (`unhandledRejection`) + CI coverage gate | 🔴 | 2027-01-10 |

---

## ✅ DONE

| Ticket | Title | Completed |
|--------|-------|-----------|
| PRE-001 | TS1128 fix on updateEMAs() private method | 2026-11-25 |
| PRE-002 | Duplicate functions removed (test-utils.ts, timezone.ts) | 2026-11-25 |
| PRE-003 | turbo.json pipeline→tasks (Turbo 2.x) | 2026-11-25 |
| PRE-004 | packages/shared/tsconfig.json created | 2026-11-25 |
| PRE-005 | Package exports dist/index.js → src/index.ts | 2026-11-25 |
| PRE-006 | Duplicate docs/strategy-docs.md removed | 2026-11-25 |
| PRE-007 | Cost config: STT 0.001, exchange 0.0005 | 2026-11-25 |
| PRE-008 | EMA tests 10/10 passing (UTC+EDT matrix) | 2026-11-25 |
| PRE-009 | Resample tests 10/10 passing (UTC+EDT matrix) | 2026-11-25 |
| PRE-010 | GitHub Actions CI matrix configured | 2026-11-25 |
| PRE-011 | Git repo clean — 6 commits, conventional format | 2026-11-25 |
| S1-001 | Replace CryptoJS → AES-256-GCM + encryption tests | 2026-11-26 |
| S1-002 | Fix relative import in instrument-resolver.ts | 2026-11-26 |
| S1-003 | Fix StreamingSignalGenerator bracket bug (TS1128 + deadlock) | 2026-11-26 |
| S1-007 | Create apps/api/src/config.ts | 2026-11-26 |
| S1-008 | Create apps/api/src/logger.ts | 2026-11-26 |
| S1-011 | Align Groww auth schema & client to TOTP Token + QR flow | 2026-11-26 |
| S1-004 | Fix createExitSignal optionSymbol/strike/expiry state | 2026-11-26 |
| S1-005 | Fix reconciliation realizedPnl + closedReason + audit log | 2026-11-26 |
| S1-006 | Create all 9 API route stubs + wire into index.ts | 2026-11-26 |
| S1-009 | Add regression test: entry fires after exit | 2026-11-26 |
| S1-010 | Add regression test: exit signal carries optionSymbol | 2026-11-26 |
| S0-001 | Pushed commits to GitHub (`origin/main`) | 2026-11-26 |
| S2-001 | Write `crossover.test.ts` (6 test cases, 98.15% line cov) | 2026-11-26 |
| S2-003 | Write `instrument-resolver.test.ts` (6 test cases) | 2026-11-26 |
| S2-002 | Complete `generator.test.ts` (8 cases, 98.21% line cov) | 2026-11-26 |
| S2-007 | Add `buildInstrumentIndex()` O(1) lookup to `instrument-resolver` | 2026-11-26 |

---

*Board v1.0 · 2026-11-26 · 55 open tickets across 6 sprints*
