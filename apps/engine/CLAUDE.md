# CLAUDE.md - Engine Package (Long-lived Process)

## Purpose
Always-on process for paper & live trading.
Runs on VPS/Docker with fixed IP for Groww API access.

## Deployment
- Platform: VPS (systemd) or Docker
- Fixed outbound IP for Groww whitelisting
- 24/7 during market hours

## Rules

### Credentials
- **Only place Groww credentials live**
- TOTP secret, API keys, master key here
- NEVER on Vercel

### Architecture
- Polls `engine_commands` from API
- Writes `engine_state` for dashboard
- WebSocket to Groww for market data
- Reconciliation on startup

### Trading Loop
```
1. Receive 1m ticks via WebSocket
2. Build resampled candles (5m/15m/30m)
3. Update StreamingEMA
4. Generate signals via StreamingSignalGenerator
5. Check exits FIRST (always honored)
6. Check entries (gated by window)
7. Place orders via Groww REST API
8. Update engine_state
```

### Risk Enforcement (Server-side ONLY)
- Daily loss limit check before every order
- Position limits check
- Margin check
- 15:00 square-off unconditional
- Short option stop-loss (premium doubles)

### Idempotency
- Every order: generate UUID → store in `live_fills` → place order
- Prevents duplicate orders on retry

### Crash Recovery
- On startup: reconcile with Groww positions
- Load last processed bar, open signals
- Replay missed bars if gap < 1 day

## Files
```
src/
├── index.ts                 # Entry point
├── config.ts                # Env config
├── db/
│   └── command-state.ts     # Command/state tables
├── services/
│   ├── websocket-manager.ts # Groww WS
│   ├── groww-client.ts      # Groww REST API
│   ├── command-processor.ts # Process API commands
│   ├── reconciliation.ts    # Crash recovery
│   ├── market-data.ts       # Candle building
│   ├── paper-trading.ts     # Paper engine
│   └── live-trading.ts      # Live engine
```

## Commands
```bash
bun run dev          # Dev with --watch
bun run build        # Build to dist/
bun run start        # Production start
bun run test         # Tests
bun run typecheck    # Type check
```

## Environment Variables
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
ENCRYPTION_MASTER_KEY=...  # From OS keychain/systemd credentials
GROWW_API_BASE_URL=https://api.groww.in
HOST_ID=engine-1
PORT=3001
LOG_LEVEL=info
```