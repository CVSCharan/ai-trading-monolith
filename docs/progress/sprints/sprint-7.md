# 🎨 Sprint 7 — UI Polish, Full Interactive Terminal & Browser E2E Audit

> **Start**: 2027-01-12 IST  
> **Target End**: 2027-01-16 IST (5 days)  
> **Status**: ⏳ QUEUED  
> **Gate from Sprint 6**: All 3 apps (`web`, `api`, `engine`) running + live trading gates implemented  
> **Gate to Production**: Every route visually verified in Chrome DevTools with zero unstyled elements, console errors, or broken responsive layouts

---

## Goal

Upgrade the minimal Sprint 5 scaffold into a **classic, professional, modern institutional trading UI** built on **shadcn/ui** (`clsx`, `tailwind-merge`, `class-variance-authority`, Radix UI primitives) + **Tailwind CSS** + **Recharts** + **Lightweight Charts**, making overall trading performance, active positions, signals, and risk immediately scannable, with full Chrome DevTools browser verification.

## Design Direction

- **Aesthetic**: Classic modern pro trading desk (inspired by Linear / Bloomberg-lite / TradingView dark slate): crisp `1px` borders, subtle card elevation, high-contrast typography, `font-mono tabular-nums` for every price, strike, quantity, and P&L figure.
- **Component System**: `shadcn/ui`-style accessible primitives in `apps/web/src/components/ui/` (`Button`, `Card`, `Badge`, `Table`, `Tabs`, `Dialog`, `Select`, `Tooltip`, `Separator`).
- **Overall Trading Clarity**: At-a-glance KPI strip (Net Equity, Day P&L, Win Rate / Profit Factor, Active Mode & Engine Health), clear Emerald (`#10b981`) vs Rose (`#f43f5e`) P&L semantics, and 1-click drill-down from any trade row into the Trade Auditor candlestick + option context view.

---

## Sprint Checklist

- [ ] Tailwind CSS compiles all utility classes cleanly from both repo root and `apps/web` (`vite build` zero warnings)
- [ ] All 7 routes render with consistent dark trading-terminal theme, typography, and zero console/network errors
- [ ] `DashboardPage` shows live equity sparkline (Recharts), Today's P&L, open positions mini-table, and recent signals feed
- [ ] `TradeContextPanel` displays option chain snapshot, Greeks, cost breakdown, and IV context
- [ ] `LiveTradingPage` exposes the 6-gate prerequisite checklist, mode guard (`<LiveGuard>`), and Emergency Stop action
- [ ] Browser E2E visual audit completed at desktop (`1440px`) and laptop/tablet (`1024px`) viewports

---

## Tickets

### S7-001 — Fix Tailwind/PostCSS Resolution + shadcn/ui Primitives {#S7-001}
| **ETA** | 2027-01-12 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Fix `apps/web/vite.config.ts` / `apps/web/postcss.config.js` so Tailwind resolves `apps/web/tailwind.config.js` regardless of CWD (`vite build apps/web` from root vs `apps/web`). Install `clsx`, `tailwind-merge`, `class-variance-authority`, and Radix primitives, and add `apps/web/src/components/ui/` (`Button`, `Card`, `Badge`, `Table`, `Tabs`, `Dialog`, `Select`) with `tabular-nums` financial styling.

### S7-002 — Collapsible Sidebar, Header Status & Route Guards {#S7-002}
| **ETA** | 2027-01-12 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Upgrade `apps/web/src/App.tsx` layout with collapsible sidebar navigation, header engine/API health badge, Paper/Live mode indicator, `<AuthGuard>` redirect to `/settings` (or `/login`), and `<LiveGuard>` gating when `live_trading_enabled = false`.

### S7-003 — Full DashboardView (Recharts Sparkline, P&L, Positions, SignalFeed) {#S7-003}
| **ETA** | 2027-01-13 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Replace the 3 static status cards on `/` with:
- Equity curve sparkline (`recharts`)
- Today's realized + unrealized MTM P&L summary card (`PortfolioBar`)
- Open positions mini-table with live WebSocket updates
- Recent signals feed (`SignalFeed`)

### S7-004 — TradeContextPanel (Option Chain, Greeks, Cost Breakdown) {#S7-004}
| **ETA** | 2027-01-13 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Enrich `TradeAuditorPage.tsx` with `TradeContextPanel.tsx`: option chain snapshot at fill time, Greeks (`delta`, `gamma`, `theta`, `vega`, `IV`), and itemized cost breakdown (STT, exchange, SEBI, stamp duty, GST, brokerage).

### S7-005 — Backtest Equity Curve (Recharts) & Trade Pagination {#S7-005}
| **ETA** | 2027-01-14 | **Priority** | 🟡 Important |
|---------|------------|--------------|--------------|

Add Recharts area chart for the backtest equity curve, drawdown series, and paginated/filterable trades table in `BacktestResultsPage.tsx`.

### S7-006 — LiveTradingPage (6-Gate Checklist + Emergency Stop UI) {#S7-006}
| **ETA** | 2027-01-14 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Replace placeholder `/live-trading` route with `LiveTradingPage.tsx`: live 6-gate prerequisite status table (≥100 paper trades, PF > 1.5, Max DD < 10%, 2FA, admin approval, Groww token), enable/disable toggle, and prominent Emergency Stop confirmation dialog.

### S7-007 — Browser Visual Inspection & Responsive Audit (DevTools) {#S7-007}
| **ETA** | 2027-01-15 | **Priority** | 🔴 Critical |
|---------|------------|--------------|-------------|

Start `apps/api` and `apps/web`, inspect every route in a real browser via Chrome DevTools (`1440×900` and `1024×768`), verify charts/tables/forms render cleanly with zero console errors, and update `S5-015` + Sprint 7 checklist.

---

*Sprint 7 · Target: 2027-01-16 · 7 tickets*
