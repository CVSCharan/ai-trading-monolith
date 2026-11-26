# Sprint 18 — Multi-Market Session Clocks & Lifecycle Alerts

**Sprint Dates**: 2026-11-26 → 2026-12-16  
**Theme**: Comprehensive Multi-Market session clocks across NSE, BSE, CDS Currency, and MCX Commodities, featuring US-DST aware closing hours, automated 4-stage lifecycle alerts (Open, -10m pre-close, Close, +10m post-close), and live in-app toasts + clocks.

---

## Tickets

### S18-001 — Multi-Market Registry & US-DST Awareness (`packages/shared/src/markets.ts`) ✅
- Defined `MARKETS` registry covering 7 market segments:
  - **NSE Equity (Cash)**: 09:15–15:30 IST
  - **NSE F&O**: 09:15–15:30 IST (with 15:20 square-off/warning alerts)
  - **BSE Equity (Cash)**: 09:15–15:30 IST
  - **Currency Derivatives (INR Pairs)**: 09:00–17:00 IST
  - **Currency Derivatives (Cross-Currency)**: 09:00–19:30 IST
  - **MCX Commodity (Agri)**: 09:00–17:00 IST
  - **MCX Commodity (Non-Agri/Bullion/Metals/Energy)**: 09:00–23:30 IST during US DST (summer), 09:00–23:55 IST outside US DST (winter).
- Implemented `isUSDST(date)` helper for precise daylight saving transitions (second Sunday in March to first Sunday in November).
- Implemented `getMarketStatuses(date)` computing real-time status (`OPEN`, `CLOSING_SOON`, `PRE_OPEN`, `CLOSED`), time to open/close, and next event string.

### S18-002 — IST Engine Scheduler Market Lifecycle Crons (`apps/engine/src/services/scheduler.ts`) ✅
- Implemented `getMarketAlertSchedules()` generating 28 distinct IST cron schedules across all 7 markets for:
  1. `MARKET_OPEN` (e.g. 09:00 / 09:15 IST)
  2. `MARKET_CLOSING_SOON` (10 minutes before close)
  3. `MARKET_CLOSED` (e.g. 15:30 / 17:00 / 19:30 / 23:30 / 23:55 IST)
  4. `MARKET_POST_CLOSE` (10 minutes after close for EOD wrap & recon)
- Wired `TradingScheduler` to dispatch real-time alerts via `WebSocketManager` (`market_alerts` channel) and `AlertingService` (Telegram + Webhook).

### S18-003 — Market Sessions API (`GET /api/market/sessions`) ✅
- Added `GET /api/market/sessions` in `apps/api/src/routes/market-data.ts`.
- Returns live status of all 7 market segments, timestamp, and server IST time with session authentication guard.

### S18-004 — In-App Market Clocks & Floating Alert Toast Banner ✅
- Created `apps/web/src/components/MarketSessionClocks.tsx`:
  - `MarketClockHeaderPill`: Dynamic interactive pill in `Header.tsx` showing current primary market status, remaining time, and expandable dropdown with all 7 market sessions.
  - `MarketAlertToastBanner`: Floating top-right notification banner auto-triggered whenever a `market_alerts` event is broadcast over WebSocket, auto-dismissing after 12s.
  - `MarketSessionsDashboardCard`: Full multi-column session grid in `DashboardPage.tsx` displaying real-time segment hours, statuses, and countdowns.
