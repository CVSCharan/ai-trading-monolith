// ============================================
// Trading Engine - Long-lived process for paper/live trading
// Runs on dedicated host with fixed IP for Groww API access
// ============================================

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import pino from 'pino';
import { config } from './config';
import { engineCommands, engineState, engineHealth, reconciliationState } from './db/command-state';
import { eq, and, lt, isNull, desc, sql } from 'drizzle-orm';
import { StreamingSignalGenerator } from '@groww-trading/strategy-core';
import { WebSocketManager } from './services/websocket-manager';
import { GrowwClient } from './services/groww-client';
import { CommandProcessor } from './services/command-processor';
import { ReconciliationService } from './services/reconciliation';
import { MarketDataService } from './services/market-data';
import { PaperTradingEngine } from './services/paper-trading';
import { LiveTradingEngine } from './services/live-trading';
import { TradingScheduler } from './services/scheduler';

// Logger (human-readable in dev, JSON + secret redaction in production)
const logger = pino({
  name: 'groww-engine',
  level: config.logLevel,
  redact: {
    paths: [
      '*.totp',
      '*.totpSecret',
      '*.totpToken',
      '*.accessToken',
      '*.refreshToken',
      '*.apiKey',
      '*.apiSecret',
      '*.masterKey',
    ],
    censor: '[REDACTED]',
  },
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

// Database connections
const pgClient = postgres(config.databaseUrl, { max: config.dbPoolSize });
export const db = drizzle(pgClient);

// Services
const wsManager = new WebSocketManager(logger);
const growwClient = new GrowwClient(config.groww, logger);
const reconciliation = new ReconciliationService(db, logger);
const marketData = new MarketDataService(growwClient, db, logger);
const commandProcessor = new CommandProcessor(db, logger, growwClient);
const paperEngine = new PaperTradingEngine(db, logger, growwClient, marketData);
const liveEngine = new LiveTradingEngine(db, logger, growwClient, marketData);
const scheduler = new TradingScheduler(db, logger, growwClient);

// Elysia app for health checks and metrics
const app = new Elysia()
  .use(cors())
  .use(jwt({ secret: config.jwtSecret }))
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .get('/metrics', () => ({ /* basic metrics */ }))
  .listen(config.port);

logger.info({ port: config.port }, 'Engine HTTP server started');

// Main engine loop
let isShuttingDown = false;
const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const COMMAND_POLL_INTERVAL = 2000; // 2 seconds
const STATE_PUBLISH_INTERVAL = 5000; // 5 seconds

async function startEngine() {
  logger.info('Starting trading engine...');

  // Load Groww credentials and authenticate (non-fatal in dev if none configured yet)
  try {
    await growwClient.initialize();
  } catch (err) {
    logger.warn({ err }, 'Groww credentials not initialized — live Groww calls disabled until configured');
  }

  // Forward live market ticks to WebSocket subscribers
  marketData.onTick((tick) => {
    wsManager.broadcast('ticks', tick);
  });

  // Start market data WebSocket
  await marketData.connect();

  // Start IST scheduler
  scheduler.start();

  // Start command polling
  setInterval(pollCommands, COMMAND_POLL_INTERVAL);

  // Start heartbeat
  setInterval(publishHeartbeat, HEARTBEAT_INTERVAL);

  // Start state publishing
  setInterval(publishState, STATE_PUBLISH_INTERVAL);

  // Handle graceful shutdown
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Trading engine started');
}

async function pollCommands() {
  if (isShuttingDown) return;

  try {
    // Get pending commands for all users
    const pending = await db
      .select()
      .from(engineCommands)
      .where(eq(engineCommands.status, 'pending'))
      .orderBy(engineCommands.createdAt);

    for (const cmd of pending) {
      await commandProcessor.processCommand(cmd);
    }
  } catch (error) {
    logger.error({ err: error }, 'Error polling commands');
  }
}

async function publishHeartbeat() {
  if (isShuttingDown) return;

  try {
    const health: typeof engineHealth.$inferInsert = {
      hostId: config.hostId,
      status: 'healthy',
      lastCheck: new Date(),
      metrics: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        wsConnections: wsManager.getConnectionCount(),
      },
      activeSessions: commandProcessor.getActiveSessionCount(),
      errorsLastHour: commandProcessor.getErrorCount(),
    };

    await db.insert(engineHealth).values(health);
  } catch (error) {
    logger.error({ err: error }, 'Error publishing heartbeat');
  }
}

async function publishState() {
  if (isShuttingDown) return;

  try {
    // Engine publishes state per user/run-type
    // This is called by paperEngine and liveEngine internally
    // Here we just ensure the health record is fresh
  } catch (error) {
    logger.error({ err: error }, 'Error publishing state');
  }
}

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('Shutting down trading engine...');

  // Stop scheduler
  scheduler.stop();

  // Stop all active sessions
  await commandProcessor.stopAllSessions();

  // Close market data WebSocket
  await marketData.disconnect();

  // Close Groww client
  await growwClient.close();

  // Close database
  await pgClient.end();

  // Close HTTP server
  app.stop();

  logger.info('Trading engine stopped');
  process.exit(0);
}

// Global process crash handlers (S6-013)
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection in trading engine');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception in trading engine — initiating shutdown');
  void shutdown();
});

// Start the engine
startEngine().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start engine');
  process.exit(1);
});