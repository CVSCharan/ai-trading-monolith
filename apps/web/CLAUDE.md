# CLAUDE.md - Web Package (Vercel Static)

## Purpose
React dashboard for: strategy config, backtest results, trade auditor, paper/live monitoring.

## Deployment
- Platform: Vercel Static (Hobby plan compatible)
- Root Directory: `apps/web`
- Build: `bun run build`
- Output: `dist/`

## Rules

### Data Fetching
- TanStack Query for all server state
- Polling for real-time updates (every 3-5s)
- No WebSocket (Vercel static can't maintain connections)

### Charts
- Lightweight Charts (TradingView) for candlesticks
- 60fps target
- Trade auditor: 1m candles ±30min, EMA overlay, markers

### State
- Zustand for client state (auth, UI, theme)
- No trading logic in frontend

### Pages
```
/                    Dashboard
/strategy/builder    Strategy configuration
/backtest/results/:id  Backtest detail
/trade-auditor/:tradeId  Candlestick chart with trade markers
/paper-trading       Paper trading panel
/live-trading        Live trading monitor (gated)
/screener            Penny stock screener
/settings            User settings & API keys
```

### API Client
- Base URL from `VITE_API_URL`
- Engine state from polling `engine_state` table via API

## Files
```
src/
├── pages/              # Route-level components
├── components/
│   ├── charts/         # EquityChart, TradeCandlestickChart
│   ├── forms/          # StrategyForm, RiskConfigForm
│   ├── tables/         # TradeTable, BacktestTable
│   └── ui/             # shadcn/ui components
├── hooks/              # useAuth, useStrategies, etc.
├── stores/             # Zustand stores
├── services/           # API clients
└── main.tsx            # Entry point
```

## Commands
```bash
bun run dev          # Vite dev server
bun run build        # Production build
bun run preview      # Preview build
bun run test         # Tests
bun run typecheck    # Type check
```