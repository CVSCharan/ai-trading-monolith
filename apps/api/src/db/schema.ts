// ============================================
// API Database Schema (Drizzle ORM)
// Shared with engine via Postgres
// ============================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  decimal,
  date,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
  pgEnum,
  time,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================
// Enums
// ============================================

export const executionModeEnum = pgEnum('execution_mode', [
  'DEEP_ITM_BUY',
  'ATM_BUY',
  'ATM_SELL',
]);

export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'DEMO']);

export const timeframeEnum = pgEnum('timeframe', ['5m', '15m', '30m']);

export const signalTypeEnum = pgEnum('signal_type', ['BUY', 'SELL']);

export const tradeSideEnum = pgEnum('trade_side', ['LONG', 'SHORT']);

export const orderSideEnum = pgEnum('order_side', ['BUY', 'SELL']);

export const exitReasonEnum = pgEnum('exit_reason', [
  'OPPOSITE_CROSSOVER',
  'SQUARE_OFF_1500',
  'REVERSAL',
  'DAILY_LOSS_LIMIT',
  'MARGIN_CALL',
  'MANUAL',
  'STOP_LOSS_SHORT',
]);

export const runTypeEnum = pgEnum('run_type', ['backtest', 'paper', 'live']);

export const orderStatusEnum = pgEnum('order_status', [
  'PENDING',
  'OPEN',
  'COMPLETE',
  'CANCELLED',
  'REJECTED',
  'PARTIAL',
]);

export const orderTypeEnum = pgEnum('order_type', ['MARKET', 'LIMIT', 'SL', 'SL-M']);

export const optionTypeEnum = pgEnum('option_type', ['CE', 'PE']);

export const instrumentTypeEnum = pgEnum('instrument_type', ['INDEX', 'FUT', 'OPT']);

export const expiryTypeEnum = pgEnum('expiry_type', ['WEEKLY', 'MONTHLY']);

// ============================================
// Better Auth Tables (managed by Better Auth)
// These are created by Better Auth migrations
// ============================================
// user, session, account, verification, passkey

// ============================================
// User Profiles (extends Better Auth user)
// ============================================

export const userProfiles = pgTable('user_profiles', {
  userId: varchar('user_id', { length: 255 }).primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 100 }),
  timezone: varchar('timezone', { length: 50 }).default('Asia/Kolkata'),
  paperCapital: decimal('paper_capital', { precision: 15, scale: 2 }).default('1000000'),
  riskLimits: jsonb('risk_limits').notNull().default(sql`'{
    "maxDailyLossPct": 2,
    "maxPositions": 3,
    "maxPositionsPerStrategy": 1,
    "perTradeRiskPct": 1,
    "blockedPeriods": ["09:15-09:30", "15:15-15:30"],
    "shortOptionStopLossPct": 100
  }'`),
  role: varchar('role', { length: 20 }).notNull().default('SUPER_ADMIN'),
  liveTradingEnabled: boolean('live_trading_enabled').default(false),
  liveTradingApprovedAt: timestamp('live_trading_approved_at', { withTimezone: true }),
  twoFactorSecretEncrypted: text('two_factor_secret_encrypted'),
  twoFactorEnabledAt: timestamp('two_factor_enabled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// Groww Credentials (Envelope Encrypted)
// ============================================

export const growwCredentials = pgTable('groww_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  apiKeyEncrypted: text('api_key_encrypted').notNull(), // Holds TOTP Token (or API Key)
  apiSecretEncrypted: text('api_secret_encrypted'),     // Optional: null in Groww TOTP flow
  totpSecretEncrypted: text('totp_secret_encrypted').notNull(), // Base32 secret from QR
  accessTokenEncrypted: text('access_token_encrypted'),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  lastRefreshAt: timestamp('last_refresh_at', { withTimezone: true }),
  refreshCountToday: integer('refresh_count_today').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// Instrument Master (Lot sizes, strike steps, validity)
// ============================================

export const instruments = pgTable('instruments', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  symbol: varchar('symbol', { length: 50 }).notNull(),
  instrumentType: instrumentTypeEnum('instrument_type').notNull(),
  name: varchar('name', { length: 200 }),
  exchange: varchar('exchange', { length: 20 }).default('NSE'),
  segment: varchar('segment', { length: 20 }).default('FO'),
  lotSize: integer('lot_size').notNull(),
  tickSize: decimal('tick_size', { precision: 10, scale: 4 }).default('0.05'),
  strikeStep: integer('strike_step'),
  underlyingSymbol: varchar('underlying_symbol', { length: 50 }),
  strikePrice: decimal('strike_price', { precision: 12, scale: 2 }),
  optionType: optionTypeEnum('option_type'),
  expiryDate: date('expiry_date'),
  expiryType: expiryTypeEnum('expiry_type'),
  isActive: boolean('is_active').default(true),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),
  growwToken: varchar('groww_token', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  lookupIdx: index('instruments_lookup_idx').on(table.symbol, table.instrumentType, table.isActive, table.validFrom, table.validTo),
  growwTokenUid: uniqueIndex('instruments_groww_token_uidx').on(table.growwToken),
  // Unique constraint for non-NULL fields
  // For index rows: strike_price, option_type, expiry_date are NULL
  // Use partial indexes for better uniqueness
}));

// Partial unique indexes for better deduplication
// (Applied via migration)

// ============================================
// 1-Minute Candles (Raw)
// Partitioned by month in production
// ============================================

export const candles1m = pgTable('candles_1m', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  instrumentId: bigint('instrument_id', { mode: 'number' }).notNull().references(() => instruments.id, { onDelete: 'cascade' }),
  barTime: timestamp('bar_time', { withTimezone: true }).notNull(),
  open: decimal('open', { precision: 12, scale: 4 }).notNull(),
  high: decimal('high', { precision: 12, scale: 4 }).notNull(),
  low: decimal('low', { precision: 12, scale: 4 }).notNull(),
  close: decimal('close', { precision: 12, scale: 4 }).notNull(),
  volume: bigint('volume', { mode: 'number' }).notNull(),
  oi: bigint('oi', { mode: 'number' }),
  bid: decimal('bid', { precision: 12, scale: 4 }),
  ask: decimal('ask', { precision: 12, scale: 4 }),
  source: varchar('source', { length: 20 }).default('groww'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  instTimeIdx: index('candles_1m_inst_time_idx').on(table.instrumentId, table.barTime),
  timeIdx: index('candles_1m_time_idx').on(table.barTime),
  uniqueInstTime: uniqueIndex('candles_1m_unique_inst_time').on(table.instrumentId, table.barTime),
}));

// ============================================
// Resampled Candles (Raw OHLCV only - indicators computed on read)
// ============================================

export const candlesResampled = pgTable('candles_resampled', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  instrumentId: bigint('instrument_id', { mode: 'number' }).notNull().references(() => instruments.id, { onDelete: 'cascade' }),
  timeframe: timeframeEnum('timeframe').notNull(),
  barTime: timestamp('bar_time', { withTimezone: true }).notNull(),
  open: decimal('open', { precision: 12, scale: 4 }).notNull(),
  high: decimal('high', { precision: 12, scale: 4 }).notNull(),
  low: decimal('low', { precision: 12, scale: 4 }).notNull(),
  close: decimal('close', { precision: 12, scale: 4 }).notNull(),
  volume: bigint('volume', { mode: 'number' }).notNull(),
  oi: bigint('oi', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  lookupIdx: index('candles_resampled_lookup_idx').on(table.instrumentId, table.timeframe, table.barTime),
  uniqueInstTfTime: uniqueIndex('candles_resampled_unique_inst_tf_time').on(table.instrumentId, table.timeframe, table.barTime),
}));

// ============================================
// Strategies
// ============================================

export const strategies = pgTable('strategies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  underlyingSymbol: varchar('underlying_symbol', { length: 50 }).notNull(),
  timeframe: timeframeEnum('timeframe').notNull(),
  entryStartTime: time('entry_start_time').notNull(),
  entryEndTime: time('entry_end_time').notNull(),
  exitTime: time('exit_time').default('15:00:00').notNull(),
  executionMode: executionModeEnum('execution_mode').notNull(),
  strikeOffset: integer('strike_offset').default(5),
  lots: integer('lots').default(1),
  expiryPreference: varchar('expiry_preference', { length: 10 }).default('WEEKLY'),
  avoidExpiryDays: integer('avoid_expiry_days').default(2),
  riskParams: jsonb('risk_params').notNull().default('{}'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('strategies_user_idx').on(table.userId),
  activeIdx: index('strategies_active_idx').on(table.isActive),
}));

// ============================================
// Signals (Audit trail for every signal generated)
// ============================================

export const signals = pgTable('signals', {
  id: uuid('id').primaryKey().defaultRandom(),
  strategyId: uuid('strategy_id').notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  runType: runTypeEnum('run_type').notNull(),
  barTime: timestamp('bar_time', { withTimezone: true }).notNull(),
  signalType: signalTypeEnum('signal_type').notNull(),
  ema9: decimal('ema_9', { precision: 12, scale: 4 }).notNull(),
  ema21: decimal('ema_21', { precision: 12, scale: 4 }).notNull(),
  spotPrice: decimal('spot_price', { precision: 12, scale: 2 }).notNull(),
  selectedStrike: decimal('selected_strike', { precision: 12, scale: 2 }),
  optionType: optionTypeEnum('option_type'),
  optionSymbol: varchar('option_symbol', { length: 100 }),
  expiryDate: date('expiry_date'),
  entryWindowValid: boolean('entry_window_valid').notNull(),
  isReversal: boolean('is_reversal').default(false),
  currentPosition: tradeSideEnum('current_position'),
  metadata: jsonb('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  strategyTimeIdx: index('signals_strategy_time_idx').on(table.strategyId, table.barTime),
  runTypeIdx: index('signals_run_type_idx').on(table.runType, table.barTime),
}));

// ============================================
// Backtest Runs
// ============================================

export const backtestRuns = pgTable('backtest_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  strategyId: uuid('strategy_id').notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  initialCapital: decimal('initial_capital', { precision: 15, scale: 2 }).notNull(),
  finalCapital: decimal('final_capital', { precision: 15, scale: 2 }),
  totalTrades: integer('total_trades').default(0),
  winningTrades: integer('winning_trades').default(0),
  losingTrades: integer('losing_trades').default(0),
  maxDrawdown: decimal('max_drawdown', { precision: 10, scale: 2 }),
  sharpeRatio: decimal('sharpe_ratio', { precision: 10, scale: 4 }),
  sortinoRatio: decimal('sortino_ratio', { precision: 10, scale: 4 }),
  calmarRatio: decimal('calmar_ratio', { precision: 10, scale: 4 }),
  profitFactor: decimal('profit_factor', { precision: 10, scale: 4 }),
  winRate: decimal('win_rate', { precision: 5, scale: 2 }),
  avgWin: decimal('avg_win', { precision: 12, scale: 2 }),
  avgLoss: decimal('avg_loss', { precision: 12, scale: 2 }),
  maxConsecutiveWins: integer('max_consecutive_wins'),
  maxConsecutiveLosses: integer('max_consecutive_losses'),
  status: varchar('status', { length: 20 }).default('pending'),
  errorMessage: text('error_message'),
  configSnapshot: jsonb('config_snapshot').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  strategyIdx: index('backtest_runs_strategy_idx').on(table.strategyId),
  userIdx: index('backtest_runs_user_idx').on(table.userId),
}));

// ============================================
// Backtest Trades (Separate from live/paper)
// ============================================

export const backtestTrades = pgTable('backtest_trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  backtestRunId: uuid('backtest_run_id').notNull().references(() => backtestRuns.id, { onDelete: 'cascade' }),
  signalId: uuid('signal_id').references(() => signals.id, { onDelete: 'set null' }),
  tradeNum: integer('trade_num').notNull(),
  symbol: varchar('symbol', { length: 50 }).notNull(),
  optionSymbol: varchar('option_symbol', { length: 100 }).notNull(),
  side: tradeSideEnum('side').notNull(),
  entryTime: timestamp('entry_time', { withTimezone: true }).notNull(),
  entryPrice: decimal('entry_price', { precision: 12, scale: 4 }).notNull(),
  exitTime: timestamp('exit_time', { withTimezone: true }),
  exitPrice: decimal('exit_price', { precision: 12, scale: 4 }),
  quantity: integer('quantity').notNull(),
  grossPnl: decimal('gross_pnl', { precision: 12, scale: 2 }),
  costs: decimal('costs', { precision: 12, scale: 2 }),
  netPnl: decimal('net_pnl', { precision: 12, scale: 2 }),
  exitReason: exitReasonEnum('exit_reason'),
  metadata: jsonb('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  runIdx: index('backtest_trades_run_idx').on(table.backtestRunId, table.entryTime),
}));

// ============================================
// Paper Trading
// ============================================

export const paperPortfolios = pgTable('paper_portfolios', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  cashBalance: decimal('cash_balance', { precision: 15, scale: 2 }).default('1000000').notNull(),
  totalValue: decimal('total_value', { precision: 15, scale: 2 }).default('1000000').notNull(),
  dailyPnl: decimal('daily_pnl', { precision: 15, scale: 2 }).default('0'),
  dayStartValue: decimal('day_start_value', { precision: 15, scale: 2 }).default('1000000'),
  isActive: boolean('is_active').default(true),
  sessionStartedAt: timestamp('session_started_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const paperPositions = pgTable('paper_positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  portfolioId: uuid('portfolio_id').notNull().references(() => paperPortfolios.id, { onDelete: 'cascade' }),
  optionSymbol: varchar('option_symbol', { length: 100 }).notNull(),
  side: tradeSideEnum('side').notNull(),
  quantity: integer('quantity').notNull(),
  avgEntryPrice: decimal('avg_entry_price', { precision: 12, scale: 4 }).notNull(),
  currentPrice: decimal('current_price', { precision: 12, scale: 4 }),
  unrealizedPnl: decimal('unrealized_pnl', { precision: 12, scale: 2 }).default('0'),
  realizedPnl: decimal('realized_pnl', { precision: 12, scale: 2 }).default('0'),
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedReason: varchar('closed_reason', { length: 50 }),
}, (table) => ({
  portfolioSymbolIdx: uniqueIndex('paper_positions_unique_open').on(table.portfolioId, table.optionSymbol).where(sql`closed_at IS NULL`),
}));

export const paperTrades = pgTable('paper_trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  portfolioId: uuid('portfolio_id').notNull().references(() => paperPortfolios.id, { onDelete: 'cascade' }),
  signalId: uuid('signal_id').references(() => signals.id, { onDelete: 'set null' }),
  optionSymbol: varchar('option_symbol', { length: 100 }).notNull(),
  side: orderSideEnum('side').notNull(),
  entryTime: timestamp('entry_time', { withTimezone: true }).notNull(),
  entryPrice: decimal('entry_price', { precision: 12, scale: 4 }).notNull(),
  exitTime: timestamp('exit_time', { withTimezone: true }),
  exitPrice: decimal('exit_price', { precision: 12, scale: 4 }),
  quantity: integer('quantity').notNull(),
  grossPnl: decimal('gross_pnl', { precision: 12, scale: 2 }),
  costs: decimal('costs', { precision: 12, scale: 2 }),
  netPnl: decimal('net_pnl', { precision: 12, scale: 2 }),
  exitReason: exitReasonEnum('exit_reason'),
  fillMetadata: jsonb('fill_metadata').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  portfolioIdx: index('paper_trades_portfolio_idx').on(table.portfolioId, table.entryTime),
}));

// ============================================
// Live Trading (Audit-critical)
// ============================================

export const liveFills = pgTable('live_fills', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  signalId: uuid('signal_id').references(() => signals.id, { onDelete: 'set null' }),
  growwOrderId: varchar('groww_order_id', { length: 100 }),
  idempotencyKey: uuid('idempotency_key').notNull().unique(),
  symbol: varchar('symbol', { length: 50 }).notNull(),
  optionSymbol: varchar('option_symbol', { length: 100 }).notNull(),
  side: orderSideEnum('side').notNull(),
  orderType: orderTypeEnum('order_type').notNull(),
  quantity: integer('quantity').notNull(),
  limitPrice: decimal('limit_price', { precision: 12, scale: 4 }),
  triggerPrice: decimal('trigger_price', { precision: 12, scale: 4 }),
  status: orderStatusEnum('status').notNull(),
  filledQuantity: integer('filled_quantity').default(0),
  avgFillPrice: decimal('avg_fill_price', { precision: 12, scale: 4 }),
  placedAt: timestamp('placed_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  userTimeIdx: index('live_fills_user_time_idx').on(table.userId, table.placedAt),
  growwOrderIdx: index('live_fills_groww_order_idx').on(table.growwOrderId),
  idempotencyIdx: index('live_fills_idempotency_idx').on(table.idempotencyKey),
}));

export const livePositions = pgTable('live_positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  optionSymbol: varchar('option_symbol', { length: 100 }).notNull(),
  side: tradeSideEnum('side').notNull(),
  quantity: integer('quantity').notNull(),
  avgEntryPrice: decimal('avg_entry_price', { precision: 12, scale: 4 }).notNull(),
  currentPrice: decimal('current_price', { precision: 12, scale: 4 }),
  unrealizedPnl: decimal('unrealized_pnl', { precision: 12, scale: 2 }).default('0'),
  realizedPnl: decimal('realized_pnl', { precision: 12, scale: 2 }).default('0'),
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedReason: varchar('closed_reason', { length: 50 }),
}, (table) => ({
  userSymbolIdx: uniqueIndex('live_positions_unique_open').on(table.userId, table.optionSymbol).where(sql`closed_at IS NULL`),
}));

// ============================================
// Audit Logs (Immutable - enforced by revoked privileges + trigger)
// ============================================

export const auditLogs = pgTable('audit_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: varchar('user_id', { length: 255 }).references(() => user.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userTimeIdx: index('audit_logs_user_time_idx').on(table.userId, table.createdAt),
  entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
}));

// ============================================
// Cost Configs (Dated - single source of truth)
// ============================================

export const costConfigs = pgTable('cost_configs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  brokeragePerOrder: decimal('brokerage_per_order', { precision: 10, scale: 2 }).notNull(),
  sttPct: decimal('stt_pct', { precision: 8, scale: 6 }).notNull(),
  exchangePct: decimal('exchange_pct', { precision: 8, scale: 6 }).notNull(),
  gstPct: decimal('gst_pct', { precision: 6, scale: 4 }).notNull(),
  sebiPerCrore: decimal('sebi_per_crore', { precision: 10, scale: 2 }).notNull(),
  stampPct: decimal('stamp_pct', { precision: 8, scale: 6 }).notNull(),
  defaultSpreadPct: decimal('default_spread_pct', { precision: 6, scale: 4 }),
  slippageSpreadFraction: decimal('slippage_spread_fraction', { precision: 4, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  effectiveFromUid: uniqueIndex('cost_configs_effective_from_uidx').on(table.effectiveFrom),
}));

// ============================================
// Market Data Cache
// ============================================

export const marketDataCache = pgTable('market_data_cache', {
  cacheKey: varchar('cache_key', { length: 255 }).primaryKey(),
  data: jsonb('data').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  expiresIdx: index('market_data_cache_expires_idx').on(table.expiresAt),
}));

// ============================================
// Engine Command & State Tables (Shared with engine app)
// ============================================

export const engineCommands = pgTable('engine_commands', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  commandType: varchar('command_type', { length: 50 }).notNull(),
  payload: jsonb('payload').notNull().default('{}'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  result: jsonb('result'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (table) => ({
  userIdx: index('engine_commands_user_idx').on(table.userId),
  statusIdx: index('engine_commands_status_idx').on(table.status),
}));

export const engineState = pgTable('engine_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  runType: varchar('run_type', { length: 20 }).notNull(),
  isRunning: boolean('is_running').notNull().default(false),
  sessionId: uuid('session_id'),
  lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }).defaultNow().notNull(),
  currentPositions: jsonb('current_positions').notNull().default('[]'),
  dailyPnl: jsonb('daily_pnl').notNull().default('{}'),
  openOrders: jsonb('open_orders').notNull().default('[]'),
  lastSignal: jsonb('last_signal'),
  riskMetrics: jsonb('risk_metrics').notNull().default('{}'),
  metadata: jsonb('metadata').notNull().default('{}'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userRunIdx: uniqueIndex('engine_state_user_run_idx').on(table.userId, table.runType),
  heartbeatIdx: index('engine_state_heartbeat_idx').on(table.lastHeartbeat),
}));

export const engineHealth = pgTable('engine_health', {
  id: uuid('id').primaryKey().defaultRandom(),
  hostId: varchar('host_id', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('healthy'),
  lastCheck: timestamp('last_check', { withTimezone: true }).defaultNow().notNull(),
  metrics: jsonb('metrics').notNull().default('{}'),
  activeSessions: integer('active_sessions').notNull().default(0),
  errorsLastHour: integer('errors_last_hour').notNull().default(0),
  metadata: jsonb('metadata').notNull().default('{}'),
}, (table) => ({
  hostIdx: index('engine_health_host_idx').on(table.hostId),
}));

// ============================================
// Reconciliation State (Crash Recovery)
// ============================================

export const reconciliationState = pgTable('reconciliation_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  runType: varchar('run_type', { length: 20 }).notNull(),
  lastProcessedBar: timestamp('last_processed_bar', { withTimezone: true }),
  openSignals: jsonb('open_signals').notNull().default('[]'),
  openPositionsSnapshot: jsonb('open_positions_snapshot'),
  growwPositionsSnapshot: jsonb('groww_positions_snapshot'),
  pendingCommands: jsonb('pending_commands').notNull().default('[]'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userRunIdx: uniqueIndex('reconciliation_state_user_run_idx').on(table.userId, table.runType),
}));

// ============================================
// Watchlists (S8-001: DB-backed Custom Watchlist)
// ============================================

export const watchlists = pgTable('watchlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  symbol: varchar('symbol', { length: 100 }).notNull(),
  exchange: varchar('exchange', { length: 20 }).notNull().default('NSE'),
  segment: varchar('segment', { length: 20 }).notNull().default('FO'),
  instrumentKey: varchar('instrument_key', { length: 100 }),
  notes: varchar('notes', { length: 255 }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userSymbolIdx: uniqueIndex('watchlists_user_symbol_idx').on(table.userId, table.symbol, table.exchange),
  userSortIdx: index('watchlists_user_idx').on(table.userId, table.sortOrder),
}));

// ============================================
// TypeScript Types
// ============================================

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

export type GrowwCredential = typeof growwCredentials.$inferSelect;
export type NewGrowwCredential = typeof growwCredentials.$inferInsert;

export type Instrument = typeof instruments.$inferSelect;
export type NewInstrument = typeof instruments.$inferInsert;

export type Candle1m = typeof candles1m.$inferSelect;
export type NewCandle1m = typeof candles1m.$inferInsert;

export type CandleResampled = typeof candlesResampled.$inferSelect;
export type NewCandleResampled = typeof candlesResampled.$inferInsert;

export type Strategy = typeof strategies.$inferSelect;
export type NewStrategy = typeof strategies.$inferInsert;

export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;

export type BacktestRun = typeof backtestRuns.$inferSelect;
export type NewBacktestRun = typeof backtestRuns.$inferInsert;

export type BacktestTrade = typeof backtestTrades.$inferSelect;
export type NewBacktestTrade = typeof backtestTrades.$inferInsert;

export type PaperPortfolio = typeof paperPortfolios.$inferSelect;
export type NewPaperPortfolio = typeof paperPortfolios.$inferInsert;

export type PaperPosition = typeof paperPositions.$inferSelect;
export type NewPaperPosition = typeof paperPositions.$inferInsert;

export type PaperTrade = typeof paperTrades.$inferSelect;
export type NewPaperTrade = typeof paperTrades.$inferInsert;

export type LiveFill = typeof liveFills.$inferSelect;
export type NewLiveFill = typeof liveFills.$inferInsert;

export type LivePosition = typeof livePositions.$inferSelect;
export type NewLivePosition = typeof livePositions.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type CostConfig = typeof costConfigs.$inferSelect;
export type NewCostConfig = typeof costConfigs.$inferInsert;

export type EngineCommand = typeof engineCommands.$inferSelect;
export type NewEngineCommand = typeof engineCommands.$inferInsert;

export type EngineState = typeof engineState.$inferSelect;
export type NewEngineState = typeof engineState.$inferInsert;

export type EngineHealth = typeof engineHealth.$inferSelect;
export type NewEngineHealth = typeof engineHealth.$inferInsert;

export type ReconciliationState = typeof reconciliationState.$inferSelect;
export type NewReconciliationState = typeof reconciliationState.$inferInsert;

// Import user table from Better Auth (it creates its own)
import { user, session, account, verification, passkey } from './better-auth-schema';
export { user, session, account, verification, passkey };