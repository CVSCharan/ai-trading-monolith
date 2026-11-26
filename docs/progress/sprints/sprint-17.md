# Sprint 17 — Live Quote Auto-Pricing & Multi-Stock Market-Open Bot

**Sprint Dates**: 2026-11-26 → 2026-12-16  
**Theme**: Live market quote auto-pricing for any NSE/NFO stock or option, live MTM updates, and dynamic multi-stock engine subscriptions from Watchlist & Strategies.

---

## Tickets

### S17-001 — Live Quote API (`GET /api/market/quote`) ✅
- `apps/api/src/routes/market-data.ts`: Fetch live quote (`ltp`, `open`, `high`, `low`, `close`) via `UpstoxClient.getQuote()` (`UPSTOX_ANALYTICS_TOKEN`) plus IST market-open status (`09:15–15:30 IST` Mon–Fri).

### S17-002 — Auto-LTP & Live MTM in `PaperTradingPage.tsx` ✅
- Selecting any stock/index/option in `SymbolSearchInput` auto-fetches live LTP from `/api/market/quote` and fills the order price.
- Shows live market status (`Market Open` / `Closed`) and updates open positions' live LTP before Square Off.

### S17-003 — Dynamic Watchlist + Strategy Feed (`MarketDataService` + `scheduler.ts`) ✅
- `MarketDataService.connect()` queries `watchlists` and active `strategies` from Postgres and subscribes `UpstoxMarketDataFeed` to all pinned/active symbols alongside `Nifty 50` and `Nifty Bank`.
- `TradingScheduler` refreshes subscriptions at `09:15 IST` market open (`15 9 * * 1-5`).
