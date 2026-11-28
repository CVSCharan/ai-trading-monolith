# Architecture Decision: n8n Integration & Remaining Production Phases

> **Role:** Principal Quant Systems Architect · FinTech Security & Compliance Officer  
> **Date:** 2026-11-28

---

## 1. Should We Use n8n in `ai-trading-monolith`?

### Short Answer
**Optional — NOT required for core trading, and NEVER in the order execution path.**  
Only introduce n8n as an **asynchronous external sidecar** if you want low-code multi-channel fan-out (WhatsApp/Telegram/Slack/Email) or multi-source scraping without maintaining those connectors in TypeScript.

---

### Architectural Boundary (Industry & SEBI/NSE INSP77559 Best Practice)

| Module | Use n8n? | Justification |
|---|---|---|
| **Trading Engine (`apps/engine`)** — ticks, bars, signals, `LiveTradingEngine`, `PaperTradingEngine`, Stop-Loss, Kill Switch | **NO (Forbidden)** | Execution requires sub-second deterministic latency, PostgreSQL ACID state, idempotency keys, and static-IP compliance. External workflow hops introduce latency, split-brain risk, and audit gaps. |
| **Core Auth, Risk Limits & Broker Credentials (`apps/api`)** | **NO** | Must stay inside TypeScript + Zod + Better Auth + AES-256-GCM DB encryption with strict RBAC and immutable audit logs. |
| **Multi-Source News & Corporate Filings (`Market Pulse`)** | **Optional Sidecar** | Our native [news-service.ts](file:///d:/CVS/9X/myPassion/ai-trading-monolith/apps/api/src/services/news-service.ts) + [news-scheduler.ts](file:///d:/CVS/9X/myPassion/ai-trading-monolith/apps/api/src/services/news-scheduler.ts) already handles RSS + LLM/deterministic classification at `08:30`, `30m` intraday, and `15:35 IST`. Use n8n *only* if you want to aggregate 10+ external sources (NSE filings, YouTube transcripts, Reddit/X, paid APIs) and `POST` normalized JSON to an HMAC-signed `POST /api/webhooks/n8n/news` endpoint. |
| **Post-Trade Digests & Multi-Channel Alerts** | **Best Fit (If Adopted)** | Great for taking `08:30 IST` Pre-Market Briefs, `15:35 IST` EOD P&L + Journal Adherence summaries, and price alerts and fanning them out to **Telegram, WhatsApp, Discord, Slack, or Gmail** visually. |

### Security Contract If n8n Is Connected
- n8n **never** holds Groww/Upstox trading credentials or DB write credentials.
- Communication is strictly over HTTPS webhooks signed with **HMAC-SHA256 (`X-Webhook-Signature`)** + timestamp replay protection + Zod schema validation.

---

## 2. What Is Still Missing (Remaining Phases — Industry Best Practices)

### Phase 1 — Quant & Market Intelligence Upgrades (Native, Zero Extra Infra)
1. **NSE Official Data in `Market Pulse`:**
   - Ingest **India VIX**, **FII/DII net cash & F&O activity**, and **NSE Corporate Announcements** (results, board meetings, order wins) filtered to pinned watchlist symbols.
   - Upgrade `ai_market_briefs.marketRegime` to factor in **actual India VIX + Nifty ATR** alongside news sentiment.
2. **Live Watchlist Quotes & Price/EMA Alerts:**
   - Stream live LTP and day `% change` on [WatchlistPanel.tsx](file:///d:/CVS/9X/myPassion/ai-trading-monolith/apps/web/src/components/WatchlistPanel.tsx).
   - Add user-configured price / crossover / OI alerts delivered via WebSocket + Telegram (`alerting.ts`).
3. **EOD Automated Trader Review (`15:35 IST`):**
   - Combine day's `paper_trades` / `live_fills` P&L + `trade_journal_entries` rule-adherence score into a daily scorecard in `ai_market_briefs`.

### Phase 2 — Remaining Critical Production Hardening (`docs/gaps.md`)
1. **GAP-01 (Distributed Rate Limiting):** Move in-memory rate-limit `Map` to Redis (`ioredis` / Upstash) for multi-instance safety.
2. **GAP-02 (Immutable Audit Trail):** Apply PostgreSQL `REVOKE UPDATE, DELETE` + append-only trigger migration on `audit_logs`.
3. **GAP-03 (ACID DB Transactions):** Wrap `liveFills` + `livePositions` and `paperPositions` + `paperTrades` writes in `db.transaction()`.
4. **GAP-14 & GAP-29 (Encrypted Upstox Credentials):** Create `upstox_credentials` table (AES-256-GCM) and persist `access_token` from `/api/upstox/callback`.
5. **GAP-30 (Backtester Hardening):** Use `FOR UPDATE SKIP LOCKED` in `backtest-runner.ts`, IST date boundaries, and add `GET /api/backtest/runs` list endpoint.
6. **GAP-06 (Time-Series Partitioning):** Partition `candles_1m` by month before multi-year historical data ingestion.
