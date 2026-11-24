// ============================================
// Engine-API Command & State Tables (Shared via Postgres)
// ============================================

import { pgTable, uuid, varchar, timestamp, jsonb, boolean, integer, text, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Commands written by API, polled by engine
export const engineCommands = pgTable('engine_commands', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  commandType: varchar('command_type', { length: 50 }).notNull(), // 'start_paper', 'stop_paper', 'enable_live', 'disable_live', 'emergency_stop', 'update_risk'
  payload: jsonb('payload').notNull().default('{}'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  result: jsonb('result'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (table) => ({
  userIdx: index('engine_commands_user_idx').on(table.userId),
  statusIdx: index('engine_commands_status_idx').on(table.status),
  createdIdx: index('engine_commands_created_idx').on(table.createdAt),
}));

// State written by engine, read by API/dashboard
export const engineState = pgTable('engine_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(),
  runType: varchar('run_type', { length: 20 }).notNull(), // 'paper', 'live'
  isRunning: boolean('is_running').notNull().default(false),
  sessionId: uuid('session_id'), // Links to paper_portfolios or live session
  lastHeartbeat: timestamp('last_heartbeat', { withTimezone: true }).defaultNow().notNull(),
  currentPositions: jsonb('current_positions').notNull().default('[]'),
  dailyPnl: jsonb('daily_pnl').notNull().default('{}'), // { date: pnl }
  openOrders: jsonb('open_orders').notNull().default('[]'),
  lastSignal: jsonb('last_signal'),
  riskMetrics: jsonb('risk_metrics').notNull().default('{}'),
  metadata: jsonb('metadata').notNull().default('{}'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userRunIdx: uniqueIndex('engine_state_user_run_idx').on(table.userId, table.runType),
  heartbeatIdx: index('engine_state_heartbeat_idx').on(table.lastHeartbeat),
}));

// Engine health & monitoring
export const engineHealth = pgTable('engine_health', {
  id: uuid('id').primaryKey().defaultRandom(),
  hostId: varchar('host_id', { length: 100 }).notNull(), // Identifies this engine instance
  status: varchar('status', { length: 20 }).notNull().default('healthy'), // 'healthy', 'degraded', 'down'
  lastCheck: timestamp('last_check', { withTimezone: true }).defaultNow().notNull(),
  metrics: jsonb('metrics').notNull().default('{}'), // { cpu, memory, ws_connections, latency_ms }
  activeSessions: integer('active_sessions').notNull().default(0),
  errorsLastHour: integer('errors_last_hour').notNull().default(0),
  metadata: jsonb('metadata').notNull().default('{}'),
}, (table) => ({
  hostIdx: index('engine_health_host_idx').on(table.hostId),
  lastCheckIdx: index('engine_health_last_check_idx').on(table.lastCheck),
}));

// Reconciliation state for crash recovery
export const reconciliationState = pgTable('reconciliation_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  runType: varchar('run_type', { length: 20 }).notNull(), // 'paper', 'live'
  lastProcessedBar: timestamp('last_processed_bar', { withTimezone: true }),
  openSignals: jsonb('open_signals').notNull().default('[]'),
  openPositionsSnapshot: jsonb('open_positions_snapshot'),
  growwPositionsSnapshot: jsonb('groww_positions_snapshot'),
  pendingCommands: jsonb('pending_commands').notNull().default('[]'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userRunIdx: uniqueIndex('reconciliation_state_user_run_idx').on(table.userId, table.runType),
}));

// TypeScript types
export type EngineCommand = typeof engineCommands.$inferSelect;
export type NewEngineCommand = typeof engineCommands.$inferInsert;

export type EngineState = typeof engineState.$inferSelect;
export type NewEngineState = typeof engineState.$inferInsert;

export type EngineHealth = typeof engineHealth.$inferSelect;
export type NewEngineHealth = typeof engineHealth.$inferInsert;

export type ReconciliationState = typeof reconciliationState.$inferSelect;
export type NewReconciliationState = typeof reconciliationState.$inferInsert;

// Command payloads
export interface StartPaperCommand {
  strategyIds: string[];
  initialCapital?: number;
}

export interface StopPaperCommand {
  strategyIds?: string[]; // undefined = all
}

export interface EnableLiveCommand {
  strategyIds: string[];
  twoFactorVerified: boolean;
}

export interface UpdateRiskCommand {
  maxDailyLossPct?: number;
  maxPositions?: number;
  blockedPeriods?: string[];
}

export interface EmergencyStopCommand {
  cancelOrders: boolean;
  closePositions: boolean;
  reason: string;
}

// State payloads
export interface PositionState {
  optionSymbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  openedAt: string;
}

export interface OrderState {
  id: string;
  growwOrderId?: string;
  optionSymbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  status: 'PENDING' | 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED';
  filledQuantity: number;
  avgFillPrice?: number;
  placedAt: string;
}

export interface SignalState {
  strategyId: string;
  signalType: 'BUY' | 'SELL';
  barTime: string;
  spotPrice: number;
  optionSymbol: string;
  entryWindowValid: boolean;
  isReversal: boolean;
}