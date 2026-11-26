# Sprint 16 — Unlimited Multi-Asset Paper Trading Desk

**Sprint Dates**: 2026-11-26 → 2026-12-14  
**Theme**: Remove symbol restrictions and enable unlimited manual & automated paper trading across any NSE/NFO stock, index, or option.

---

## Tickets

### S16-001 — Any-Symbol Strategy Support (`strategy.ts` + `StrategyBuilderPage.tsx`) ✅
- Relax `StrategyBodySchema.underlyingSymbol` to accept any uppercase NSE/NFO symbol (`RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `NIFTY`, `BANKNIFTY`, etc.).
- Add custom symbol input + quick preset chips in `StrategyBuilderPage.tsx`.

### S16-002 — Quick Paper Order & 1-Click Close (`paper-trading.ts`) ✅
- `POST /api/paper/order`: Place instant BUY/SELL paper trades on any symbol/stock/option.
- `POST /api/paper/close/:id`: Square off an open paper position at specified/current price, logging `paperTrades` + updating portfolio P&L.

### S16-003 — Reset / Top-Up Paper Capital (`paper-trading.ts`) ✅
- `POST /api/paper/reset`: Reset virtual paper capital (`₹10,00,000` or custom) anytime while preserving historical trade logs.

### S16-004 — Paper Trading Desk Upgrade (`PaperTradingPage.tsx`) ✅
- Quick Paper Order ticket + Reset Capital button (`SUPER_ADMIN` / `<RoleGuard>`).
- 1-click Square Off on open positions + Closed Paper Trade History table (`GET /api/paper/history`).
