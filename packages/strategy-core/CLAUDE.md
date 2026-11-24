# CLAUDE.md - Strategy Core Package

## Purpose
Pure TypeScript strategy logic with **zero external dependencies** (only `@groww-trading/shared`).
Used by: backtest (API), paper trading (engine), live trading (engine), trade auditor (web).

## Rules

### Dependencies
- ONLY depend on `@groww-trading/shared` (types, constants, timezone)
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