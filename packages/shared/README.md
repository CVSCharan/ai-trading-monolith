# Groww Trading Shared

Shared types, constants, and utilities for the Groww Trading System.

## Purpose

Provides common types, constants, and utilities used across all apps and packages in the monorepo. Ensures consistency and single source of truth.

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Bun (for tests)
- **Dependencies**: Zod (validation)

## Documentation

- [Project Plan](../../../docs/project-plan.md)
- [Architecture](../../../docs/architecture.md)

## Quick Start

```bash
# Install dependencies
bun install

# Development (watch mode)
bun run dev

# Build
bun run build

# Test
bun test

# Type check
bun run typecheck
```

## Project Structure

```
packages/shared/
├── src/
│   ├── constants.ts       # Shared constants (enums, defaults, market hours)
│   ├── timezone.ts        # IST timezone utilities (critical for trading)
│   ├── types.ts           # Shared TypeScript types
│   ├── index.ts           # Main exports
│   └── test-utils.ts      # Test utilities (not exported)
├── test/                  # Test files
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## Exports

```typescript
// Constants
export { MARKET_HOURS, TIMEFRAMES, EXECUTION_MODES, ... } from './constants';

// Timezone utilities (CRITICAL - all time math MUST use these)
export { nowIST, toIST, getAlignedBarTimeIST, isInEntryWindow, isSquareOffTime, ... } from './timezone';

// Types
export type { Timeframe, ExecutionMode, SignalType, TradeSide, ... } from './types';
export type { Candle1m, CandleResampled, Instrument, StrategyConfig, ... } from './types';
```

## Key Modules

### `constants.ts`
All shared constants and enums:
- Market hours (09:15-15:30 IST)
- Timeframes (1m, 5m, 15m, 30m)
- Execution modes (DEEP_ITM_BUY, ATM_BUY, ATM_SELL)
- Signal types (BUY, SELL)
- Trade sides (LONG, SHORT)
- Order sides (BUY, SELL)
- Exit reasons, run types, order statuses
- Default risk limits
- Default lot sizes (from instrument master)
- Strike steps
- Rate limits, pagination, cache TTLs

### `timezone.ts` (CRITICAL)
**All time handling MUST use these utilities.**
- `nowIST()` - Current time in IST
- `toIST(date)` - Convert any date to IST
- `getMinutesIST(date)` - Minutes since midnight in IST
- `isInEntryWindow(date, start, end, blockedPeriods)` - Half-open interval [start, end)
- `isSquareOffTime(date, '15:00')` - Check 15:00 square-off
- `getAlignedBarTimeIST(timestamp, timeframeMinutes)` - 09:15 aligned bars
- `getBarCloseTimeIST(barOpen, timeframeMinutes)` - Bar close time
- `getNextMinuteOpenIST(timestamp)` - Next 1m candle open
- `isTradingDay(date)` - Mon-Fri check
- `getMarketOpen/close(date)` - Market hours for date

**Never use `Date.now()`, `new Date()`, `getHours()`, `getMinutes()` without timezone conversion.**

### `types.ts`
All shared TypeScript types:
- Market data: `Candle1m`, `CandleResampled`, `Instrument`
- Strategy: `StrategyConfig`, `RiskConfig`, `CostConfig`
- Signals/Trades: `Signal`, `TradeBase`, `Position`, `PortfolioState`
- Backtest: `BacktestConfig`, `BacktestResult`, `BacktestTrade`, `EquityPoint`, `DailyReturn`
- Margin: `MarginRequirement`

## Development Commands

```bash
# From package root
bun run dev          # Watch mode
bun run build        # Compile to dist/
bun run test         # Run tests
bun run typecheck    # TypeScript check
bun run lint         # Lint
```

## Usage in Other Packages

```json
// In package.json of consuming package
"dependencies": {
  "@groww-trading/shared": "workspace:*"
}
```

```typescript
// Import in other packages
import { createUTCForIST, isInEntryWindow, isSquareOffTime } from '@groww-trading/shared';
import type { StrategyConfig, Signal, CandleResampled } from '@groww-trading/shared';
```

## Rules (from CLAUDE.md)

### Time & Timezone (CRITICAL)
- **ALL time handling MUST use IST (Asia/Kolkata)**
- Use `packages/shared/src/timezone.ts` helpers exclusively
- Never use `Date.now()`, `new Date()`, `getHours()`, `getMinutes()` without timezone conversion
- Market hours: 09:15 - 15:30 IST
- Resample alignment: 09:15 anchor

### Code Quality
- TypeScript strict mode
- Zod validation at all boundaries
- Tests for all pure functions
- No `any` types without justification

## Testing

```bash
bun test              # Run tests
bun run typecheck     # TypeScript check
bun run build         # Build to dist/
```

## License

Private - Internal use only