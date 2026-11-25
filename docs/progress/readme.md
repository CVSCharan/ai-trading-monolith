# 📋 Groww AI Trading — Progress Tracking Board

> **Started**: 2026-11-26 IST  
> **Role**: Senior Fintech Architect + Algorithmic Trading Systems Engineer  
> **Solo dev** — estimates calibrated for 1 developer, ~6h productive coding/day

---

## 🗂️ Board Structure

```
docs/progress/
├── readme.md                        ← This file (master index)
├── board.md                         ← Kanban-style ticket board (live status)
├── sprints/
│   ├── sprint-immediate.md          ← GitHub push + CI enable (TODAY)
│   ├── sprint-1.5.md                ← Critical fixes (Nov 26–28)
│   ├── sprint-2.md                  ← Backtest engine + tests (Dec 1–6)
│   ├── sprint-3.md                  ← API routes + WebSocket (Dec 8–14)
│   ├── sprint-4.md                  ← Engine paper trading (Dec 15–22)
│   ├── sprint-5.md                  ← Frontend dashboard (Dec 23–Jan 1)
│   └── sprint-6.md                  ← Live trading + deploy (Jan 5–11)
├── references/
│   └── day-trader-skill.md          ← External pattern evaluation
└── daily/
    ├── 2026-11-26.md                ← Today's log
    └── template.md                  ← Daily log template
```

---

## 🗓️ Master ETA Table

| Sprint | Focus | Start | Target End | Status |
|--------|-------|-------|------------|--------|
| **Immediate** | Push to GitHub + Enable CI | 2026-11-26 | 2026-11-26 | 🔵 TODAY |
| **Sprint 1.5** | Critical bug fixes + API foundation | 2026-11-26 | 2026-11-28 | 🔵 IN PROGRESS |
| **Sprint 2** | Backtest engine + ≥90% test coverage | 2026-12-01 | 2026-12-06 | ⏳ QUEUED |
| **Sprint 3** | All API routes + WebSocket | 2026-12-08 | 2026-12-14 | ⏳ QUEUED |
| **Sprint 4** | Engine paper trading (working E2E) | 2026-12-15 | 2026-12-22 | ⏳ QUEUED |
| **Sprint 5** | Frontend dashboard + trade auditor | 2026-12-23 | 2027-01-01 | ⏳ QUEUED |
| **Sprint 6** | Live trading + production hardening | 2027-01-05 | 2027-01-11 | ⏳ QUEUED |

> **Gate before Sprint 6**: ≥ 100 paper trades · PF > 1.5 · Max DD < 10%

---

## 📌 How to Use This Board

1. **Daily**: Update `daily/YYYY-MM-DD.md` — what was done, blockers, tomorrow's plan
2. **Ticket status**: Update `board.md` as tickets move across columns
3. **Sprint end**: Check all sprint checklist items; create retrospective note in sprint file
4. **Blocked?**: Mark ticket 🔴 BLOCKED in `board.md`, log reason in daily note

---

## 🔴 Known Bugs Tracker (from architectural review)

| ID | Bug | Severity | Sprint | Status |
|----|-----|----------|--------|--------|
| BUG-001 | CryptoJS CBC instead of AES-256-GCM | 🔴 Critical | 1.5 | ⏳ Open |
| BUG-002 | Engine stubs return null/[] (never execute) | 🔴 Critical | 4 | ⏳ Open |
| BUG-003 | 9 API route files missing (server won't start) | 🔴 Critical | 1.5 | ⏳ Open |
| BUG-004 | StreamingSignalGenerator bracket bug — silent deadlock | 🔴 Critical | 1.5 | ⏳ Open |
| BUG-005 | createExitSignal returns optionSymbol: '' | 🔴 Critical | 1.5 | ⏳ Open |
| BUG-006 | instrument-resolver.ts relative import | 🟡 Important | 1.5 | ⏳ Open |
| BUG-007 | Reconciliation closes positions with realizedPnl: 0 | 🔴 Critical | 1.5 | ⏳ Open |

---

*Last updated: 2026-11-26 by architect review*
