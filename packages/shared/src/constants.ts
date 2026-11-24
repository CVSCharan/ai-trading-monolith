// ============================================
// Shared Constants & Enums
// ============================================

export const MARKET_HOURS = {
  OPEN: '09:15',
  CLOSE: '15:30',
  TIMEZONE: 'Asia/Kolkata',
  PRE_OPEN_START: '09:00',
  PRE_OPEN_END: '09:15',
} as const;

export const TIMEFRAMES = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
} as const;

export type Timeframe = keyof typeof TIMEFRAMES;

export const EXECUTION_MODES = [
  'DEEP_ITM_BUY',
  'ATM_BUY',
  'ATM_SELL'
] as const;

export type ExecutionMode = typeof EXECUTION_MODES[number];

export const SIGNAL_TYPES = ['BUY', 'SELL'] as const;
export type SignalType = typeof SIGNAL_TYPES[number];

export const TRADE_SIDES = ['LONG', 'SHORT'] as const;
export type TradeSide = typeof TRADE_SIDES[number];

export const ORDER_SIDES = ['BUY', 'SELL'] as const;
export type OrderSide = typeof ORDER_SIDES[number];

export const EXIT_REASONS = [
  'OPPOSITE_CROSSOVER',
  'SQUARE_OFF_1500',
  'REVERSAL',
  'DAILY_LOSS_LIMIT',
  'MARGIN_CALL',
  'MANUAL',
  'STOP_LOSS_SHORT'
] as const;

export type ExitReason = typeof EXIT_REASONS[number];

export const RUN_TYPES = ['backtest', 'paper', 'live'] as const;
export type RunType = typeof RUN_TYPES[number];

export const ORDER_STATUSES = [
  'PENDING',
  'OPEN',
  'COMPLETE',
  'CANCELLED',
  'REJECTED',
  'PARTIAL'
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const ORDER_TYPES = ['MARKET', 'LIMIT', 'SL', 'SL-M'] as const;
export type OrderType = typeof ORDER_TYPES[number];

export const OPTION_TYPES = ['CE', 'PE'] as const;
export type OptionType = typeof OPTION_TYPES[number];

export const INSTRUMENT_TYPES = ['INDEX', 'FUT', 'OPT'] as const;
export type InstrumentType = typeof INSTRUMENT_TYPES[number];

export const EXPIRY_TYPES = ['WEEKLY', 'MONTHLY'] as const;
export type ExpiryType = typeof EXPIRY_TYPES[number];

// Default risk limits
export const DEFAULT_RISK_LIMITS = {
  maxDailyLossPct: 2,
  maxPositions: 3,
  maxPositionsPerStrategy: 1,
  perTradeRiskPct: 1,
  blockedPeriods: ['09:15-09:30', '15:15-15:30'],
  shortOptionStopLossPct: 100,
} as const;

// Default lot sizes (will be overridden by instrument master)
export const DEFAULT_LOT_SIZES = {
  NIFTY: 75,
  BANKNIFTY: 25,
  FINNIFTY: 40,
} as const;

// Strike steps
export const STRIKE_STEPS = {
  NIFTY: 50,
  BANKNIFTY: 100,
  FINNIFTY: 50,
} as const;

// Default cost config (2024+) - use DB cost_configs table as source of truth
export const DEFAULT_COST_CONFIG = {
  effectiveFrom: '2024-01-01',
  brokeragePerOrder: 20,
  sttPct: 0.001,
  exchangePct: 0.0005,
  gstPct: 0.18,
  sebiPerCrore: 10,
  stampPct: 0.00003,
  defaultSpreadPct: 0.01,
  slippageSpreadFraction: 0.5,
} as const;

// API rate limits
export const RATE_LIMITS = {
  auth: { requests: 10, window: '1m' },
  marketData: { requests: 100, window: '1m' },
  backtest: { requests: 5, window: '1m' },
  paperTrading: { requests: 60, window: '1m' },
  liveTrading: { requests: 30, window: '1m' },
  websocket: { connections: 1, window: '1m' },
} as const;

// Pagination defaults
export const PAGINATION = {
  defaultLimit: 50,
  maxLimit: 200,
} as const;

// Cache TTLs
export const CACHE_TTL = {
  marketData: 60,      // 1 minute
  optionChain: 30,     // 30 seconds
  instruments: 3600,   // 1 hour
  profile: 300,        // 5 minutes
} as const;