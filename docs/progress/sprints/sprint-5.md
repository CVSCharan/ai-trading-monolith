# 🖥️ Sprint 5 — Frontend Dashboard + Trade Auditor

> **Start**: 2026-12-23 IST  
> **Target End**: 2027-01-01 IST (10 days)  
> **Status**: ⏳ QUEUED  
> **Gate from Sprint 4**: Paper trading working E2E  
> **Gate to Sprint 6**: All pages render; Trade Auditor fully functional

---

## Goal

Functional React app with real-time dashboard and interactive trade review (Trade Auditor is the key deliverable).

---

## Sprint Checklist

- [ ] All pages render without errors
- [ ] Trade Auditor loads chart + markers for a known paper trade
- [ ] Keyboard navigation (←/→) works between trades
- [ ] WebSocket reconnects and updates UI within 5 seconds
- [ ] Mobile responsive at ≥ 1024px min width

---

## Tickets

### S5-001 — Vite + React 18 + TS Init {#S5-001}
| **ETA** | 2026-12-23 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

```bash
cd apps/web
bun create vite . --template react-ts
bun add tailwindcss postcss autoprefixer
bun add @tanstack/react-query zustand react-router-dom
bun add lightweight-charts recharts
```

### S5-002 — Tailwind + shadcn/ui Setup {#S5-002}
| **ETA** | 2026-12-23 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Init Tailwind, configure `tailwind.config.ts`. Install shadcn/ui components: Button, Card, Badge, Table, Dialog, Tabs.

### S5-003 — App.tsx Router + Auth Guard {#S5-003}
| **ETA** | 2026-12-24 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

React Router v6 with all 7 routes. `<AuthGuard>` redirects to `/login` if no session. `<LiveGuard>` redirects if `live_trading_enabled = false`.

### S5-004 — Layout.tsx Sidebar + Header {#S5-004}
| **ETA** | 2026-12-24 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Collapsible sidebar nav. Header with paper/live mode toggle + engine status indicator.

### S5-005 — AuthPage.tsx {#S5-005}
| **ETA** | 2026-12-25 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Login + register forms. Better Auth client SDK. Redirect to dashboard on success.

### S5-006 — DashboardPage.tsx {#S5-006}
| **ETA** | 2026-12-25 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Equity sparkline (Recharts). Today's P&L card. Open positions mini-table. Recent signals feed. All live via TanStack Query with 10s refetch.

### S5-007 — TradeCandlestickChart.tsx {#S5-007}
| **ETA** | 2026-12-26 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Lightweight Charts candlestick. EMA9 (blue line) + EMA21 (orange line) overlay. Entry ▲ / Exit ▼ markers. ± 30 min window around trade. Zoom + pan.

### S5-008 — TradeContextPanel.tsx {#S5-008}
| **ETA** | 2026-12-27 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Right panel: option chain at fill time, greeks (delta/gamma/theta/vega/IV), cost breakdown (STT + exchange + brokerage), IV term structure.

### S5-009 — TradeAuditorPage Keyboard Nav {#S5-009}
| **ETA** | 2026-12-27 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

```
← → arrow keys navigate prev/next trade
URL updates: /trade-auditor/:id
useTrade(id) hook fetches trade data
```

### S5-010 — useWebSocket + PositionPanel {#S5-010}
| **ETA** | 2026-12-28 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

`useWebSocket(url)` hook with auto-reconnect. `PositionPanel.tsx` shows live positions with MTM P&L updating per tick.

### S5-011 — StrategyBuilderPage.tsx {#S5-011}
| **ETA** | 2026-12-29 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Form for all `StrategyConfig` fields with Zod validation. Preview mode switcher (backtest / paper / live). Save/update strategy.

### S5-012 — BacktestResultsPage.tsx {#S5-012}
| **ETA** | 2026-12-29 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Equity curve (Recharts area chart). Metrics card grid (Sharpe, Sortino, Win Rate, PF, Max DD). Paginated trades table with ETA filter.

### S5-013 — PaperTradingPage.tsx {#S5-013}
| **ETA** | 2026-12-30 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Start/stop controls. Live portfolio balance + daily P&L progress bar. Trade history table.

### S5-014 — PortfolioBar + SignalFeed {#S5-014}
| **ETA** | 2026-12-30 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

`PortfolioBar.tsx`: daily P&L vs limit (risk limit progress). `SignalFeed.tsx`: live signal stream. `OrderStatusFeed.tsx`: live order updates.

### S5-015 — Sprint 5 Checklist + Responsive Audit {#S5-015}
| **ETA** | 2027-01-01 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Run full checklist. Test at 1024px, 1280px, 1440px. Fix any layout breaks.

---

*Sprint 5 · Target: 2027-01-01 · 15 tickets*
