# Groww Trading Web

Frontend dashboard for the Groww Trading System.

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build**: Vite 5
- **Styling**: Tailwind CSS + shadcn/ui (Radix primitives)
- **State**: TanStack Query (server) + Zustand (client)
- **Charts**: Lightweight Charts (TradingView) - 60fps candlesticks
- **Routing**: React Router 6
- **Forms**: React Hook Form + Zod validation

## Documentation

- [Project Plan](../../docs/project-plan.md)
- [Architecture](../../docs/architecture.md)
- [Strategy Specification](../../docs/strategy-docs-v2.md)

## Quick Start

```bash
# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env with API URL

# Development
bun run dev

# Build
bun run build

# Preview production build
bun run preview

# Test
bun test

# Type check
bun run typecheck
```

## Project Structure

```
apps/web/
├── docs/                      # Web documentation
├── public/                    # Static assets
├── src/
│   ├── pages/                 # Page components (route-level)
│   │   ├── Dashboard.tsx      # Overview
│   │   ├── StrategyBuilder.tsx   # Strategy configuration
│   │   ├── BacktestResults.tsx   # Backtest list & detail
│   │   ├── TradeAuditor.tsx      # Candlestick chart with trade markers
│   │   ├── PaperTrading.tsx      # Paper trading panel
│   │   ├── LiveTrading.tsx       # Live trading monitor (gated)
│   │   ├── Screener.tsx          # Penny stock screener
│   │   ├── Settings.tsx          # User settings & API keys
│   │   └── Login.tsx             # Auth pages
│   ├── components/            # Reusable components
│   │   ├── charts/            # Chart components
│   │   │   ├── EquityChart.tsx
│   │   │   ├── TradeCandlestickChart.tsx
│   │   │   └── ChartToolbar.tsx
│   │   ├── forms/             # Form components
│   │   │   ├── StrategyForm.tsx
│   │   │   └── RiskConfigForm.tsx
│   │   ├── tables/            # Data tables
│   │   │   ├── TradeTable.tsx
│   │   │   └── BacktestTable.tsx
│   │   └── ui/                # shadcn/ui components
│   │       ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useStrategies.ts
│   │   ├── useBacktest.ts
│   │   ├── usePaperTrading.ts
│   │   └── useWebSocket.ts
│   ├── stores/                # Zustand stores
│   │   ├── authStore.ts
│   │   ├── strategyStore.ts
│   │   ├── paperTradingStore.ts
│   │   └── uiStore.ts
│   ├── services/              # API clients
│   │   ├── api.ts             # Base API client
│   │   ├── authApi.ts
│   │   ├── strategyApi.ts
│   │   ├── backtestApi.ts
│   │   ├── tradeApi.ts
│   │   ├── marketApi.ts
│   │   └── paperApi.ts
│   ├── types/                 # Frontend-specific types
│   ├── utils/                 # Utilities
│   │   ├── chart-helpers.ts
│   │   ├── formatters.ts
│   │   └── validators.ts
│   ├── App.tsx                # Root component
│   ├── main.tsx               # Entry point
│   └── index.css              # Global styles + Tailwind
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## Environment Variables

```bash
# API
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# Feature Flags
VITE_ENABLE_LIVE_TRADING=false
VITE_ENABLE_PAPER_TRADING=true
```

## Pages & Features

### Dashboard (`/`)
- Account overview (capital, daily P&L, open positions)
- Quick stats cards
- Recent trades
- Market status indicator

### Strategy Builder (`/strategy/builder`)
- Visual strategy configuration form
- Timeframe selection (5m/15m/30m)
- Entry window picker (09:30-14:30 in 30min increments)
- Execution mode selector (Deep ITM/ATM Buy/Sell)
- Risk parameters
- Save/Clone/Delete strategies

### Backtest Results (`/backtest/results/:id`)
- Equity curve chart (Lightweight Charts)
- Key metrics: Net P&L, Sharpe, Max DD, Win Rate, Profit Factor
- Trade list with pagination/filtering
- Daily returns heatmap
- Export to CSV

### Trade Auditor (`/trade-auditor/:tradeId`)
- **Core feature**: 1m candlestick chart ±30min around trade
- Overlay: 9 & 21 EMA on selected timeframe
- Markers: Entry (▲), Exit (▼), Reversal (⬤)
- Keyboard navigation: ←/→ for prev/next trade
- Context panel: Option chain, IV, Greeks at entry
- Tooltips: Time, Price, EMA values, P&L

### Paper Trading (`/paper-trading`)
- Virtual portfolio (₹10L default)
- Real-time signal display
- Open positions with MTM
- Start/Stop/Reset controls
- Daily P&L vs limit
- Trade history

### Live Trading (`/live-trading`) - Gated
- Read-only until 2FA + explicit enable
- Real-time positions with Greeks
- Margin utilization
- Order status feed
- **Emergency stop button** (prominent, confirmed)

### Screener (`/screener`)
- Penny stock filter (price < ₹50, vol > 1L)
- Technical filters (RSI, volume spike, breakout)
- Results table with backtest button

### Settings (`/settings`)
- Groww API credentials (encrypted)
- 2FA management
- Risk limits
- Paper trading capital
- Theme (light/dark)

## Chart Components

### TradeCandlestickChart
The most complex component - renders:
- 1-minute candlesticks (Lightweight Charts)
- 9 & 21 EMA lines (configurable timeframe)
- Trade markers with tooltips
- Volume histogram
- Crosshair sync
- Keyboard navigation (←/→)

```tsx
<TradeCandlestickChart
  tradeId="uuid"
  timeframe="15m"
  onTradeChange={(id) => navigate(`/trade-auditor/${id}`)}
/>
```

### EquityChart
Area chart for equity curve with drawdown overlay.

## State Management

### TanStack Query (Server State)
- Strategies, backtests, trades, market data
- Automatic caching, background refetch
- Optimistic updates for mutations

### Zustand (Client State)
- Auth state (user, tokens)
- UI state (sidebar, theme, toasts)
- Paper trading session state
- WebSocket connection state

## WebSocket Integration

```typescript
// Subscribe to market data
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { symbols: ['NIFTY'], timeframe: '1m' }
}));

// Subscribe to strategy signals
ws.send(JSON.stringify({
  type: 'subscribe_signals',
  payload: { strategyId: 'uuid' }
}));

// Handle messages
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'tick': updateTick(msg.payload); break;
    case 'signal': showSignal(msg.payload); break;
    case 'paper_trade': updatePaperTrade(msg.payload); break;
  }
});
```

## Styling

### Tailwind + shadcn/ui
- `src/index.css` - Tailwind imports + CSS variables
- `tailwind.config.js` - Theme extension
- `components/ui/` - shadcn components (copy from shadcn/ui)

### Dark Mode
- Class-based (`dark` on `<html>`)
- Persisted in localStorage
- System preference detection

## Testing

```bash
# Unit tests
bun test

# Component tests (React Testing Library)
bun test --match="*component*"

# E2E tests (Playwright - if configured)
bun test:e2e
```

## Building for Production

```bash
bun run build
# Output in dist/
# Deploy to Vercel/Netlify/Cloudflare Pages
```

## Deployment

### Vercel (Recommended)
```bash
# Connect repo to Vercel
# Set environment variables
# Deploy
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## Performance

- Code splitting by route (`React.lazy`)
- Chart virtualization (only render visible candles)
- WebSocket message batching
- TanStack Query cache (5min staleTime)
- Image optimization (WebP, lazy load)

## Accessibility

- Semantic HTML
- ARIA labels on interactive elements
- Keyboard navigation (all charts, tables)
- Color contrast (WCAG AA)
- Screen reader announcements for live updates

## License

Private - Internal use only