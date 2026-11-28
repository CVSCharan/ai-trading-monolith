# 🗃️ Kanban Board — AI Trader

> Updated: 2026-11-28 IST  
> Columns: **TODO** · **IN PROGRESS** · **REVIEW/BLOCKED** · **DONE**

---

## 🔵 IN PROGRESS

*All Sprint 19 execution tickets completed.* Pre-live paper trade validation and production deployment pending.

---

## ✅ DONE (Sprint 19 Releases)

| Ticket | Title | Completed |
|--------|-------|-----------|
| S6-011 | Pre-live validation checklist (12/12 items verified; 110 deterministic trades seeded via `db:seed`) | 2026-11-28 |
| S19-019 | Strict engine core type safety: eliminated `: any` in `command-processor`, `live-trading`, `paper-trading`, `index.ts` (`GAP-04`) | 2026-11-28 |
| S19-020 | Frontend API resilience: migrated all remaining pages & components to unified `fetchJson` (`GAP-31`) | 2026-11-28 |
| S19-015 | Atomic database transactions for live order & position state (`GAP-03`) | 2026-11-28 |
| S19-016 | Granular sliding-window rate limiting on sensitive 2FA & auth endpoints (`GAP-15`) | 2026-11-28 |
| S19-017 | Bad-tick & flash-spike anomaly filter in `LiveBarAggregator` (`GAP-20`) | 2026-11-28 |
| S19-018 | 32-character minimum cryptographic entropy for `BETTER_AUTH_SECRET` (`GAP-22`) | 2026-11-28 |
| AUDIT-002 | Automated strategy cross-verification matrix (`StrategyVerificationCard`) & trade directory (`/trade-auditor`) | 2026-11-28 |
| S19-008 | Broker order fill stream ingestion & dual poller sync (`BrokerOrderSyncService`) | 2026-11-28 |
| S19-011 | End-to-end multi-broker simulation test suite (`apps/engine/test/live-integration.test.ts`) | 2026-11-28 |
| S19-007 | Live option quotes: Wire `optionPriceLookup` (`MarketData` cache + dataBroker/executionBroker quotes) in `apps/engine/src/index.ts` | 2026-11-28 |
| S19-013 | Explicit reversal signal lifecycle: sequential close-then-open handling with PostgreSQL fill records | 2026-11-28 |
| S19-014 | Comprehensive Shadcn UI design system (Popover, Slider, Progress, Separator, Checkbox, Textarea, Avatar, Sheet) | 2026-11-28 |
| ACADEMY-001 | In-App Trading Academy & 9/21 EMA Strategy Cross-Verification Handbook (`/academy`) | 2026-11-28 |
| S19-005 | Operator 2FA setup, verify, disable & dynamic step-up TOTP verification on `/api/live/enable` | 2026-11-28 |
| S19-009 | Durable PostgreSQL live state (`live_fills` & `live_positions`), UUID idempotency, startup hydration | 2026-11-28 |
| S19-010 | Startup reconciliation sequence before market feeds, state hydration on boot and live enable | 2026-11-28 |
| S19-012 | NSE Circular INSP77559 regulatory compliance, algo tagging (`X-Algo-Name`, `tag: ai_trader_algo`) | 2026-11-28 |
| S19-006 | Real strategy signal classification (`BUY`/`SELL`, `metadata.isExit`, execution modes) | 2026-11-27 |
| S19-001 | Emergency stop async acknowledgment & disarm-first engine flow | 2026-11-26 |
| S19-002 | Bounded limit order emergency closes (`EMERGENCY_LIMIT_BUFFER_PCT`) | 2026-11-26 |
| S19-003 | Exit-time drawdown gate & completed trade filtering | 2026-11-26 |
| S19-004 | Glassmorphic skeleton loading architecture & fintech initial loader | 2026-11-26 |
| SEED-001 | Decoupled database seeding: removed startup seed, added standalone `db:seed` & `db:reset` CLI | 2026-11-27 |
| BRAND-001 | Monorepo rebranding: Multi-Broker Terminal (Groww, Upstox, NSE, BSE, MCX) | 2026-11-27 |

---

## 📋 BACKLOG — Production Deployment

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| S6-012 | Final production deployment + smoke test | 🔴 | 2027-01-11 |
