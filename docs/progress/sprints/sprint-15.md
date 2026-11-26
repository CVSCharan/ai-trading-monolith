# Sprint 15 — Autonomous Tick-to-Trade Pipeline, Holiday Guard & Trade Alerts

**Sprint Dates**: 2026-11-26 → 2026-12-12  
**Theme**: Complete the live tick → bar aggregation → signal pipeline, NSE holiday/expiry guards, Telegram/Webhook trade notifications, and 1-click Backtest → Paper Bot promotion.

---

## Tickets

### S15-001 — `LiveBarAggregator` (`apps/engine/src/services/live-bar-aggregator.ts`) ✅
- Aggregates incoming ticks into `09:15 IST`-aligned `5m / 15m / 30m` OHLC bars.
- Emits closed bars on boundary rollover for `StreamingSignalGenerator` → `PaperTradingEngine` / `LiveTradingEngine`.

### S15-002 — NSE Holiday & Expiry Rollover Guard (`apps/engine/src/services/nse-holidays.ts`) ✅
- `isNSETradingDay(date)` checks weekends + NSE calendar holidays (`YYYY-MM-DD` IST).
- `isExpiryRolloverWindow(date)` detects Thursday `>= 14:30 IST` to prevent fresh entries into expiring weekly contracts.
- Wired into `TradingScheduler` (`apps/engine/src/services/scheduler.ts`).

### S15-003 — Telegram & Webhook Trade Alerts (`apps/engine/src/services/alerting.ts`) ✅
- Supports `ALERT_WEBHOOK_URL` and `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`.
- Added `sendTradeAlert()` for entry, exit, and `15:00 IST` square-off notifications.

### S15-004 — 1-Click Backtest → Paper Bot Promote & Strategy Picker (`BacktestResultsPage.tsx`) ✅
- Replace raw UUID input with a Strategy `<Select>` dropdown (`GET /api/strategies`).
- Add **"Launch Paper Bot"** button right on completed backtests (`POST /api/paper/start`).

### S15-005 — Live Spot Ticker Pill in Top Navbar (`Header.tsx`) ✅
- Subscribe to `/api/market/ws` `ticks` channel and show live NIFTY 50 LTP in `Header.tsx`.
