# 🗃️ Kanban Board — AI Trader

> Updated: 2026-11-28 IST  
> Columns: **TODO** · **IN PROGRESS** · **REVIEW/BLOCKED** · **DONE**

---

## 🔵 IN PROGRESS

| Ticket | Title | Sprint | Owner | ETA |
|--------|-------|--------|-------|-----|
| S19-007 | Live option quotes: Wire `optionPriceLookup` in `apps/engine/src/index.ts` from `marketData` / `Upstox` quotes | Sprint 19 | Team | 2026-12-05 |
| S19-008 | Broker order fill stream: Pipe broker order update WebSocket events into `liveEngine.handleOrderUpdate` | Sprint 19 | Team | 2026-12-08 |
| S19-011 | End-to-end integration test: Full bar → quote → order → fill → square-off test simulation | Sprint 19 | Team | 2026-12-10 |
| S19-013 | Explicit reversal signal lifecycle (sequential close-then-open handling) | Sprint 19 | Team | 2026-12-10 |

---

## ✅ DONE (Recent S19 Releases)

| Ticket | Title | Completed |
|--------|-------|-----------|
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

## 📋 BACKLOG — Pre-Live Validation Checklist

| Ticket | Title | Priority | ETA |
|--------|-------|----------|-----|
| S6-011 | Pre-live validation checklist (12 items, requires 100+ paper trades) | 🔴 | 2027-01-10 |
| S6-012 | Final production deployment + smoke test | 🔴 | 2027-01-11 |
