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
| [S2-009](sprints/sprint-2.md#S2-009) | Verify ≥90% coverage gate (core modules ≥97%, overall 88.55% incl. shared/example) | 🟡 | 2026-12-06 |

---

## 📋 TODO — Sprint 3 (Dec 8–14)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| *(All Sprint 3 tickets complete!)* | — | — | — |

---

## 📋 TODO — Sprint 4 (Dec 15–22)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| *(All Sprint 4 tickets complete!)* | — | — | — |

---

## 📋 TODO — Sprint 5 (Dec 23–Jan 1)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| [S5-015](sprints/sprint-5.md#S5-015) | Sprint 5 checklist + mobile responsive audit | 🔴 | 2027-01-01 |

---

## 📋 TODO — Sprint 6 (Jan 5–11)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| [S6-011](sprints/sprint-6.md#S6-011) | Pre-live validation checklist (12 items, requires 100+ paper trades) | 🔴 | 2027-01-10 |
| [S6-012](sprints/sprint-6.md#S6-012) | Final production deployment + smoke test | 🔴 | 2027-01-11 |

---

## 📋 TODO — Sprint 7 (Jan 12–16 · UI Polish & Browser Audit)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| [S7-001](sprints/sprint-7.md#S7-001) | Fix Tailwind/PostCSS CWD resolution & design tokens | 🔴 | 2027-01-12 |
| [S7-002](sprints/sprint-7.md#S7-002) | Collapsible sidebar, header status & AuthGuard/LiveGuard | 🔴 | 2027-01-12 |
| [S7-003](sprints/sprint-7.md#S7-003) | Full Dashboard (Recharts sparkline, PortfolioBar, SignalFeed) | 🔴 | 2027-01-13 |
| [S7-004](sprints/sprint-7.md#S7-004) | TradeContextPanel (option chain, Greeks, cost breakdown) | 🟡 | 2027-01-13 |
| [S7-005](sprints/sprint-7.md#S7-005) | BacktestResultsPage Recharts equity curve & pagination | 🟡 | 2027-01-14 |
| [S7-006](sprints/sprint-7.md#S7-006) | LiveTradingPage (6-gate checklist + Emergency Stop UI) | 🔴 | 2027-01-14 |
| [S7-007](sprints/sprint-7.md#S7-007) | SettingsPage (`.env` Groww status, token refresh & risk guardrails) | 🔴 | 2027-01-15 |
| [S7-008](sprints/sprint-7.md#S7-008) | Browser visual inspection & responsive audit (DevTools) | 🔴 | 2027-01-16 |

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
| S2-004 | Implement `backtest/engine.ts` (`runBacktest()`, 100% cov) | 2026-11-26 |
| S2-005 | Implement `backtest/metrics.ts` (Sharpe, Sortino, Calmar, DD) | 2026-11-26 |
| S2-006 | Implement `backtest/reporter.ts` (equity curve, daily returns, report) | 2026-11-26 |
| S2-008 | Write `backtest.test.ts` (5 multi-day, P&L, 15:00 square-off cases) | 2026-11-26 |
| S3-001..004 | Implement `auth`, `rate-limit`, `audit`, `risk` middleware | 2026-11-26 |
| S3-015..016 | Add correlation IDs, global error handler, DB `/health` ping & graceful shutdown | 2026-11-26 |
| S3-005..007 | Implement `groww`, `strategy` (CRUD+clone), `backtest` (run+trades+equity) routes | 2026-11-26 |
| S3-008..011 | Implement `market-data`, `paper-trading`, `live-trading` (gated), `trade` (auditor) routes | 2026-11-26 |
| S3-012..014 | Implement `ws-manager.ts`, `backtest-runner.ts`, `user.ts`, `engine.ts` (Sprint 3 complete) | 2026-11-26 |
| S4-001..004, S4-012 | Implement `command-processor.ts` (`loadStrategy`, `loadInstruments`, `closeAll*`, `cancelAllOrders`) & `closedReason` schema | 2026-11-26 |
| S4-005..011 | Implement `websocket-manager.ts` reconnect/backfill, `paper-trading.ts` (MTM + risk + fills), `scheduler.ts` (IST cron) | 2026-11-26 |
| S4-013..014 | Add `paper-engine.test.ts` (Sprint 4 complete) | 2026-11-26 |
| S5-001..004 | Scaffold `apps/web` (Vite + React 18 + Tailwind + Router + TanStack Query + API proxy) | 2026-11-26 |
| S5-005..014 | Implement `useWebSocket`, `TradeCandlestickChart`, `TradeAuditorPage` (`←`/`→`), `StrategyBuilderPage`, `BacktestResultsPage`, `PaperTradingPage`, `SettingsPage`, `App.tsx` | 2026-11-26 |
| S6-001..010, S6-013 | Implement `GET /api/live/gates`, `LiveTradingEngine` (5 risk checks, idempotency, partial fills, 15:00 square-off), `AlertingService`, `emergency-stop.ts`, `Dockerfile`, `vercel.json`, crash handlers, `live-engine.test.ts` | 2026-11-26 |

---

*Board v1.0 · 2026-11-26 · 55 open tickets across 6 sprints*
