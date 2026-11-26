# 🗃️ Kanban Board — Groww AI Trading

> Updated: 2026-11-26 IST  
> Columns: **TODO** · **IN PROGRESS** · **REVIEW/BLOCKED** · **DONE**

---

## 🔵 IN PROGRESS

| Ticket | Title | Sprint | Owner | ETA |
|--------|-------|--------|-------|-----|
| *(All Immediate & Sprint 1–11 coding/CI tasks complete — only manual/operational gates remain below)* | — | — | — | — |

---

## 📋 TODO — Sprint 1.5 (Nov 26–28)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| *(All Sprint 1.5 coding tickets complete — only `S0-001`..`S0-004` GitHub push + CI remain)* | — | — | — |

---

## 📋 TODO — Sprint 2 (Dec 1–6)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| *(All Sprint 2 tickets complete!)* | — | — | — |

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
| [S7-008](sprints/sprint-7.md#S7-008) | Browser visual inspection & responsive audit (DevTools — requires Chrome remote debugging enabled) | 🔴 | 2027-01-16 |

---

## 📋 TODO — Sprint 8 (Jan 17–21 · Groww Pro Features)

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| *(All Sprint 8 tickets complete!)* | — | — | — |

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
| S7-001..007 | Fix Tailwind CWD resolution (`17.06 kB` CSS, 0 warnings), add `shadcn/ui` primitives, `PortfolioBar`, `SignalFeed`, `EquityAreaChart`, `DashboardPage`, `TradeContextPanel`, `LiveTradingPage`, `.env`-aware `SettingsPage` + `/api/groww/status` & `/sync` fallback | 2026-11-26 |
| S9-001..S9-011 | Auth, RBAC (`SUPER_ADMIN` / `DEMO`), Login, Forgot/Reset Password | 2026-11-26 |
| S10-001..S10-005 | Dual-Broker Architecture: Upstox Analytics + v3 Trading & Groww TOTP | 2026-11-26 |
| S8-001..S8-005 | Groww Pro Features: Custom Watchlist (`watchlists`), Margins (`/api/groww/margins`), OCO/GTT (`/api/groww/smart-order`), Historical Candles (`/api/groww/candles`), Live Positions (`/api/groww/positions`) | 2026-11-26 |
| S11-001..S11-004 | Engine `BrokerRouter` (`GrowwBrokerAdapter` + `UpstoxClient`), `UpstoxMarketDataFeed` WS v3, & `OptionChainPage` UI | 2026-11-26 |
| S0-002..S0-003 | Fix CI Secret Scan & verify UTC + America/New_York test matrix passes | 2026-11-26 |
| S0-004 | Enable branch protection on `main` requiring all 5 CI status checks | 2026-11-26 |
| S2-009 | Coverage gate verified: `upstox-client` 100%, `resample` 99.17%, core strategy modules ≥97% (67/67 tests) | 2026-11-26 |
| S6-011 / S6-012 | Add `scripts/smoke-test.ts`, `apps/api/Dockerfile`, `production-checklist.md` & verify 1-year backtest (313ms) | 2026-11-26 |
| S12-001..S12-005 | Bot Control Center (`/bot`), Strategy Lifecycle Actions, Live Orders/Positions, Audit Trail (`/audit-logs`), & Editable Risk Guardrails | 2026-11-26 |
| S13-001..S13-004 | Floating Glass Sidebar (`Sidebar`, `Header`, `AppShell`), Global CSS Viewport Lock & `shadcn/ui` Input/Select/Alert/Skeleton | 2026-11-26 |
| S14-001..S14-004 | Rolling Session Rotation, Max 3 Concurrent Devices, `logout-all`, `change-password`, `08:45 IST` Token Refresh & `ProfilePage` | 2026-11-26 |

---

*Board v1.0 · 2026-11-26 · 55 open tickets across 6 sprints*
