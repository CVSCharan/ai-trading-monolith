# AI Trader Platform — Complete Trader Ecosystem Roadmap

> **Role:** Principal Quant Platform Architect · FinTech Security Engineer · Indian Capital Markets Specialist  
> **Status:** Active Execution Plan  
> **Prerequisite Docs:** [docs/gaps.md](file:///d:/CVS/9X/myPassion/ai-trading-monolith/docs/gaps.md) · [docs/implementation-plan.md](file:///d:/CVS/9X/myPassion/ai-trading-monolith/docs/implementation-plan.md)

---

## Vision
Transform the existing `9/21 EMA` NIFTY options bot into a **complete, end-to-end Indian Retail & Algo Trader Platform**:
1. **Rock-Solid Core Execution** — zero silent bugs in strike resolution, IST time math, bar aggregation, WebSocket security, and option stop-losses.
2. **Watchlist News & AI Decision Feed** — automated market/stock news ingestion filtered to pinned symbols + AI sentiment/regime synthesis (strictly advisory, never bypassing deterministic risk gates).
3. **Zero-to-Trader Academy** — structured 6-module curriculum from market basics to algo discipline, backed by DB progress tracking, interactive quizzes, and paper-trading drills.
4. **Multi-Strategy, Cash Equity Bot & Trade Journal** — pluggable strategy templates (`EMA_CROSSOVER`, `ORB`, `VWAP_PULLBACK`, `SUPERTREND_RSI`), cash equity execution alongside options, and a structured post-trade journal.

---

## Track 1 — Critical Core Bug Fixes (`GAP-23` to `GAP-26`, `GAP-05`)

| Gap ID | Root Cause | Production Fix | Verification |
|---|---|---|---|
| **GAP-23** | `selectStrike()` hardcodes `'NIFTY'` even for `BANKNIFTY` strategies | Accept `underlyingSymbol` in `selectStrike()` and `createExitSignal()`; pass `config.underlyingSymbol` from `generateSignals()` & `StreamingSignalGenerator` | Unit test verifying `BANKNIFTY` resolves `BANKNIFTY` strike step (100) & `BANKNIFTY` option contracts |
| **GAP-24** | `createISTDate()` omits day rollback (`00:00–05:29 IST`) & `getISTDateString()` uses `toIST().toISOString()` (shifts back 1 day on IST hosts) | Replace with pure UTC epoch arithmetic (`Date.UTC(...) - 19_800_000`) and `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })` | Unit tests covering `00:15 IST`, `05:29 IST`, `09:15 IST`, `23:55 IST` |
| **GAP-25** | `/api/market/ws` has no auth check on upgrade/open, unguarded `JSON.parse()`, and broadcasts `live_updates`/`paper_updates` globally | Authenticate WS upgrade via Better Auth session cookie, wrap `JSON.parse` in `try/catch`, and scope private channels by `userId` | WS auth & channel isolation tests |
| **GAP-26** | `LiveBarAggregator` never closes the `15:15–15:30` bar; `MarketDataService` routes non-`Bank` stocks into `'NIFTY'` | Add `flushExpiredBars()` / EOD `15:30` flush timer in `LiveBarAggregator`; map `instrumentKey` explicitly in `MarketDataService` | Unit test for `15:15–15:30` bar close & multi-symbol tick isolation |
| **GAP-05** | `LiveTradingEngine` tracks `shortOptionStopLossPct` in schema/config but never enforces per-trade option premium SL on ticks | Enforce per-trade option premium stop-loss on `onOptionTick()` / `updateMarkToMarket()` in `LiveTradingEngine` and trigger protected limit square-off | Unit test verifying SL trigger closes losing short/long option position |

---

## Track 2 — Watchlist News & AI Decision Feed

### Architecture
- **Database (`apps/api/src/db/schema.ts`):**
  - `market_news`: `id`, `symbol` (nullable for macro/market-wide), `title`, `summary`, `source`, `url` (unique), `publishedAt`, `sentiment` (`BULLISH | BEARISH | NEUTRAL`), `impactLevel` (`HIGH | MEDIUM | LOW`), `eventType` (`EARNINGS | CORPORATE | MACRO | TECHNICAL | GENERAL`), `aiRationale`, `suggestedRegime`, `createdAt`.
  - `ai_market_briefs`: `id`, `briefType` (`PRE_MARKET | INTRADAY | POST_MARKET`), `istDate`, `headline`, `summaryMarkdown`, `marketRegime` (`TRENDING | RANGEBOUND | HIGH_VOLATILITY`), `keyLevels` (JSONB), `watchlistHighlights` (JSONB), `createdAt`.
- **Backend Services:**
  - `NewsIngestionService` (`apps/api/src/services/news-service.ts`): Fetches financial RSS feeds (NSE/Economic Times/Moneycontrol/Livemint RSS) + optional NewsAPI/Finnhub, deduplicates by URL, tags pinned watchlist symbols.
  - `AiAdvisorService` (`apps/api/src/services/ai-advisor.ts`): Uses `OPENAI_API_KEY` / `GEMINI_API_KEY` when configured, with a deterministic **rule-based fallback** (headline keyword + VIX/regime analyzer) so the feature works out-of-the-box even without an external LLM key.
  - **Routes (`apps/api/src/routes/news.ts`):** `GET /api/news` (filtered by watchlist/symbol/sentiment), `GET /api/news/brief` (latest pre-market/EOD brief), `POST /api/news/refresh` (manual sync).
- **UI:**
  - Dedicated **Market Pulse & AI News** page (`/pulse`) + compact **Watchlist News & Sentiment** feed on the Dashboard.

---

## Track 3 — Zero-to-Trader Curriculum & Progress Tracking

- **Database:** `academy_progress` (`id`, `userId`, `moduleId`, `lessonId`, `completedAt`, `quizScore`, `quizAttempts`).
- **API (`apps/api/src/routes/academy.ts`):** `GET /api/academy/progress`, `POST /api/academy/complete` (records lesson completion & quiz score).
- **Curriculum (6 Progressive Tracks in `TradingAcademyPage.tsx`):**
  1. **Market Foundations** — NSE/BSE structure, Order Types (Market, Limit, SL, SL-M), MIS vs NRML, settlement.
  2. **Candlesticks & Price Action** — OHLC anatomy, support/resistance, volume confirmation, false breakouts.
  3. **Risk & Capital Management** — 1–2% per-trade risk, R:R ratios, drawdown recovery math, position sizing calculator.
  4. **Technicals & Algo Logic** — 9/21 EMA, VWAP, RSI, Supertrend, why trend-following fails in chop.
  5. **Options Mastery** — CE/PE, ITM/ATM/OTM, Delta/Theta/Vega, IV crush, NSE Tuesday expiry dynamics.
  6. **Algo & Backtest Discipline** — look-ahead bias, STT/slippage drag, paper-to-live 7-gate graduation.
- **Interactive Features:** Per-module quizzes with instant feedback, progress bar persisted to Postgres, and **"Practice in Paper Mode"** deep links.

---

## Track 4 — Multi-Strategy, Cash Equity Bot & Trade Journal

- **Strategy Core (`packages/strategy-core`):**
  - Pluggable strategy types: `EMA_9_21`, `ORB` (Opening Range Breakout), `VWAP_PULLBACK`, `RSI_REVERSAL`.
  - Support `assetClass: 'INDEX_OPTIONS' | 'EQUITY_CASH'` so users can run automated strategies directly on pinned NSE stocks (e.g., `RELIANCE`, `TCS`, `HDFCBANK`) in addition to NIFTY/BANKNIFTY options.
- **Trade Journal (`apps/api/src/db/schema.ts` + `TradeAuditorPage.tsx`):**
  - `trade_journal_entries`: `id`, `userId`, `tradeId`, `tradeSource` (`BACKTEST | PAPER | LIVE`), `setupTag`, `emotionTag` (`CALM | FOMO | REVENGE | HESITANT`), `followedRules` (boolean), `notes`, `rating` (1–5), `updatedAt`.
  - API (`apps/api/src/routes/journal.ts`): `GET /api/journal`, `PUT /api/journal/:tradeId`.
  - UI: Journal drawer inside `TradeAuditorPage.tsx` + rule-adherence analytics.
