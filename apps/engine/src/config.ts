// ============================================
// Engine Configuration
// ============================================

import { z } from 'zod';

const EnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // JWT for internal auth
  JWT_SECRET: z.string().min(32),

  // Groww API (encrypted credentials from DB, but need some config)
  GROWW_API_BASE_URL: z.string().url().default('https://api.groww.in'),

  // Engine
  HOST_ID: z.string().default('engine-1'),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  // Market hours
  MARKET_OPEN: z.string().default('09:15'),
  MARKET_CLOSE: z.string().default('15:30'),
  TIMEZONE: z.string().default('Asia/Kolkata'),

  // Polling intervals (ms)
  COMMAND_POLL_INTERVAL: z.coerce.number().default(2000),
  HEARTBEAT_INTERVAL: z.coerce.number().default(10000),
  STATE_PUBLISH_INTERVAL: z.coerce.number().default(5000),

  // Reconciliation
  RECONCILE_ON_START: z.coerce.boolean().default(true),
  MAX_RECONCILIATION_DAYS: z.coerce.number().default(1),

  // Risk defaults
  DEFAULT_MAX_DAILY_LOSS_PCT: z.coerce.number().default(2),
  DEFAULT_MAX_POSITIONS: z.coerce.number().default(3),
  DEFAULT_PER_TRADE_RISK_PCT: z.coerce.number().default(1),
});

export type Env = z.infer<typeof EnvSchema>;

const env = EnvSchema.parse(process.env);

export const config = {
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
  groww: {
    apiBaseUrl: env.GROWW_API_BASE_URL,
  },
  hostId: env.HOST_ID,
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  marketOpen: env.MARKET_OPEN,
  marketClose: env.MARKET_CLOSE,
  timezone: env.TIMEZONE,
  commandPollInterval: env.COMMAND_POLL_INTERVAL,
  heartbeatInterval: env.HEARTBEAT_INTERVAL,
  statePublishInterval: env.STATE_PUBLISH_INTERVAL,
  reconcileOnStart: env.RECONCILE_ON_START,
  maxReconciliationDays: env.MAX_RECONCILIATION_DAYS,
  defaultRisk: {
    maxDailyLossPct: env.DEFAULT_MAX_DAILY_LOSS_PCT,
    maxPositions: env.DEFAULT_MAX_POSITIONS,
    perTradeRiskPct: env.DEFAULT_PER_TRADE_RISK_PCT,
  },
};