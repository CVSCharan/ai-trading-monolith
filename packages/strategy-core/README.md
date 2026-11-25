# Groww Strategy Core

Pure TypeScript strategy logic with **zero external dependencies** (only `@groww-trading/shared`).
Used by: backtest (API), paper trading (engine), live trading (engine), trade auditor (web).

## Purpose

Provides pure, testable strategy logic with zero external dependencies. All trading logic lives here to ensure identical behavior across backtest, paper, and live trading.

## Documentation

- [Project Plan](../../../docs/project-plan.md)
- [Architecture](../../../docs/architecture.md)
- [Strategy Specification](../../../docs/strategy-docs-v2.md)

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
packages/strategy-core/
├── src/
│   ├── types.ts                    # Core types + Zod schemas
│   ├── indicators/
│   │   ├── ema.ts                 # EMA calculation + streaming
│   │   ├── resample.ts            # 1m → 5m/15m/30m (09:15 aligned)
│   │   └── crossover.ts           # Crossover detection + window checks
│   ├── signals/
│   │   └── generator.ts           # Signal generation (backtest + streaming)
│   ├── execution/
│   │   ├── instrument-resolver.ts # Strike/expiry selection
│   │   └── cost-calculator.ts     # Transaction costs (dated config)
│   ├── backtest/
│   │   └── engine.ts              # Event-driven backtest
│   └── index.ts                   # Public exports
├── test/
│   ├── ema.test.ts                # EMA tests (10 tests)
│   ├── resample.test.ts           # Resample tests (10 tests)
│   └── test-utils.ts              # Shared test utilities
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## Key Features

### EMA Calculation (Proper Seeding)
- **Seeding**: SMA of first N closes
- **Warmup**: First N-1 values = NaN
- **Continuity**: Continuous across sessions (no daily reset)
- Matches TradingView/ChartIQ behavior

### Resampling (09:15 Aligned)
- 1m → 5m/15m/30m aligned to 09:15 market open
- Handles market hours boundaries (09:15-15:30)
- Short final bar handling (30m at 15:15-15:30)

### Crossover Detection
- On CLOSED bars only (no look-ahead bias)
- Bullish: EMA9 crosses ABOVE EMA21
- Bearish: EMA9 crosses BELOW EMA21

### Signal Generation
- Exits ALWAYS honored (opposite crossover, 15:00)
- Entry window gates NEW entries only
- Immediate reversal: only within entry window
- Streaming version for live/paper

### Execution
- Strike selection: Deep ITM/ATM Buy/Sell mapping
- Expiry resolution at signal time (not now())
- Cost calculator with dated config
- Spread-based slippage

### Backtest Engine
- Event-driven on 1m data
- Config snapshot for reproducibility
- Metrics: Sharpe, Sortino, Calmar, Profit Factor, Max DD
- Equity curve + daily returns

## Commands

```bash
bun test              # Run tests (20 tests passing)
bun run typecheck     # TypeScript check
bun run build         # Build to dist/
```

## Testing

```bash
bun test              # All tests (20 passing)
bun test --coverage   # Coverage report
```

## Rules (from CLAUDE.md)

### Dependencies
- ONLY depend on `@groww-trading/shared`
- No database, no HTTP, no WebSocket, no filesystem
- Pure functions - same input = same output

### Time Handling
- ALL timestamps are IST (from shared timezone helpers)
- Never create Date objects without timezone context
- Bar times are OPEN time, aligned to 09:15

### EMA Rules
- Seed: SMA of first N closes
- Warmup: First N-1 values = NaN
- Continuous across sessions (no daily reset)
- Must match TradingView/ChartIQ

### Signal Rules
- Signals on CLOSED bars only
- Exits ALWAYS honored (opposite crossover, 15:00)
- Entry window gates NEW entries only
- Reversal: only within entry window

### Strike Selection
- Deep ITM Buy: BUY→ITM Call, SELL→ITM Put
- ATM Buy: BUY→ATM Call, SELL→ATM Put
- ATM Sell: BUY→Short Put, SELL→Short Call
- Strike step from instrument master
- Expiry resolution at signal time (not now())

### Cost Calculation
- Dated config from cost_configs table
- Spread-based slippage (50% of spread default)
- STT 0.1% on sell side premium

## Testing Requirements
- Every pure function has tests
- Target: >90% coverage
- Test edge cases: warmup, boundary times, reversals
- Property-based tests for EMA/resample

## Files
```
src/
├── types.ts              # Core types + Zod schemas
├── indicators/
│   ├── ema.ts           # EMA calculation + streaming
│   ├── resample.ts      # 1m → 5m/15m/30m (09:15 aligned)
│   └── crossover.ts     # Crossover detection + window checks
├── signals/
│   └── generator.ts     # Signal generation (backtest + streaming)
├── execution/
│   ├── instrument-resolver.ts  # Strike/expiry selection
│   └── cost-calculator.ts      # Transaction costs
├── backtest/
│   └── engine.ts        # Event-driven backtest
└── index.ts             # Public exports
```

## Commands
```bash
bun test              # Run tests
bun run typecheck     # Type check
bun run build         # Build to dist/
```