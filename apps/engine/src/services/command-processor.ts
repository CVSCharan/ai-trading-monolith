// ============================================
// Command Processor - Handles API commands
// ============================================

import pino from 'pino';
import { db } from '../index';
import { engineCommands, engineState, reconciliationState } from '../db/command-state';
import {
  instruments as instrumentsTable,
  liveFills,
  livePositions,
  paperPortfolios,
  paperPositions,
  strategies as strategiesTable,
  userProfiles,
} from '../../../api/src/db/schema';
import { eq, and, inArray, isNull, desc, sql } from 'drizzle-orm';
import { GrowwClient } from './groww-client';
import {
  StreamingSignalGenerator,
  type Instrument,
  type StrategyConfig,
} from '@groww-trading/strategy-core';
import { config } from '../config';

export class CommandProcessor {
  private logger: pino.Logger;
  private activeSessions: Map<string, { paper?: any; live?: any }> = new Map();
  private errorCount = 0;
  private liveEngine?: any;

  constructor(
    private db: any,
    logger: pino.Logger,
    private growwClient: GrowwClient
  ) {
    this.logger = logger.child({ component: 'CommandProcessor' });
  }

  setLiveEngine(liveEngine: any): void {
    this.liveEngine = liveEngine;
  }

  getActiveSessions(): Map<string, { paper?: any; live?: any }> {
    return this.activeSessions;
  }

  async processCommand(cmd: any): Promise<void> {
    this.logger.info({ commandId: cmd.id, type: cmd.commandType, userId: cmd.userId }, 'Processing command');

    try {
      // Mark as processing
      await this.db
        .update(engineCommands)
        .set({ status: 'processing', processedAt: new Date() })
        .where(eq(engineCommands.id, cmd.id));

      let result: any = {};

      switch (cmd.commandType) {
        case 'start_paper':
          result = await this.startPaper(cmd.userId, cmd.payload);
          break;
        case 'stop_paper':
          result = await this.stopPaper(cmd.userId, cmd.payload);
          break;
        case 'enable_live':
          result = await this.enableLive(cmd.userId, cmd.payload);
          break;
        case 'disable_live':
          result = await this.disableLive(cmd.userId, cmd.payload);
          break;
        case 'emergency_stop':
          result = await this.emergencyStop(cmd.userId, cmd.payload);
          break;
        case 'update_risk':
          result = await this.updateRisk(cmd.userId, cmd.payload);
          break;
        default:
          throw new Error(`Unknown command type: ${cmd.commandType}`);
      }

      // Mark completed
      await this.db
        .update(engineCommands)
        .set({ status: 'completed', result })
        .where(eq(engineCommands.id, cmd.id));

      this.logger.info({ commandId: cmd.id }, 'Command completed');

    } catch (error) {
      this.errorCount++;
      this.logger.error({ err: error, commandId: cmd.id }, 'Command failed');

      await this.db
        .update(engineCommands)
        .set({ status: 'failed', errorMessage: error instanceof Error ? error.message : 'Unknown error' })
        .where(eq(engineCommands.id, cmd.id));
    }
  }

  private async startPaper(userId: string, payload: any): Promise<any> {
    const { strategyIds, initialCapital = 1000000 } = payload;

    // Create paper portfolio
    const [portfolio] = await this.db
      .insert(paperPortfolios)
      .values({
        userId,
        cashBalance: initialCapital,
        totalValue: initialCapital,
        dayStartValue: initialCapital,
        isActive: true,
        sessionStartedAt: new Date(),
      })
      .returning();

    // Initialize strategy generators for each strategy
    const generators = new Map();
    for (const strategyId of strategyIds) {
      // Load strategy config
      const strategy = await this.loadStrategy(strategyId);
      if (!strategy) continue;

      // Load instruments
      const instruments = await this.loadInstruments();

      // Create generator
      const generator = new StreamingSignalGenerator(strategy, instruments, 'paper');
      generators.set(strategyId, { generator, strategy, instruments, position: null });
    }

    this.activeSessions.set(userId, { paper: { portfolioId: portfolio.id, generators } });

    return { portfolioId: portfolio.id, strategies: strategyIds };
  }

  private async stopPaper(userId: string, payload: any): Promise<any> {
    const session = this.activeSessions.get(userId);
    if (!session?.paper) {
      return { message: 'No active paper session' };
    }

    const { strategyIds } = payload;
    if (strategyIds) {
      for (const strategyId of strategyIds) {
        session.paper.generators.delete(strategyId);
      }
    } else {
      session.paper.generators.clear();
    }

    if (session.paper.generators.size === 0) {
      // Close all positions
      await this.closeAllPaperPositions(session.paper.portfolioId);
      this.activeSessions.delete(userId);
    }

    return { stopped: true };
  }

  private async enableLive(userId: string, payload: any): Promise<any> {
    if (process.env['ENABLE_LIVE_TRADING'] !== 'true') {
      throw new Error('Live trading is disabled on the engine. Set ENABLE_LIVE_TRADING=true to permit live execution.');
    }

    if (!payload?.twoFactorVerifiedAt) {
      throw new Error('Live trading command rejected: missing verified operator twoFactorVerifiedAt timestamp.');
    }

    // Verify operator profile has 2FA enabled in DB
    const [profile] = await this.db
      .select({ twoFactorEnabledAt: userProfiles.twoFactorEnabledAt })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (!profile?.twoFactorEnabledAt) {
      throw new Error('Live trading command rejected: operator profile does not have active twoFactorEnabledAt enrollment.');
    }

    const { strategyIds = [] } = payload;
    if (!strategyIds.length) {
      throw new Error('Live trading command rejected: at least one strategyId is required.');
    }

    // Hydrate durable live positions
    if (this.liveEngine) {
      await this.liveEngine.hydratePositionsFromDb(userId);
    }

    // Initialize strategy generators for live trading
    const generators = new Map();
    for (const strategyId of strategyIds) {
      const strategy = await this.loadStrategy(strategyId);
      if (!strategy) continue;
      const instruments = await this.loadInstruments();
      const generator = new StreamingSignalGenerator(strategy, instruments, 'live');
      generators.set(strategyId, { generator, strategy, instruments, position: null });
    }

    let session = this.activeSessions.get(userId);
    if (!session) {
      session = {};
      this.activeSessions.set(userId, session);
    }
    session.live = { generators, enabledAt: new Date() };

    // Update engine state in DB
    await this.db
      .insert(engineState)
      .values({
        userId,
        runType: 'live',
        isRunning: true,
        lastHeartbeat: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [engineState.userId, engineState.runType],
        set: { isRunning: true, lastHeartbeat: new Date(), updatedAt: new Date() },
      });

    return { enabled: true, liveStrategies: strategyIds, twoFactorVerifiedAt: payload.twoFactorVerifiedAt };
  }

  private async disableLive(userId: string, payload: any): Promise<any> {
    const session = this.activeSessions.get(userId);
    if (!session?.live) {
      return { message: 'No active live session' };
    }

    // Close all live positions
    await this.closeAllLivePositions(userId);
    session.live.generators.clear();
    delete session.live;

    return { disabled: true };
  }

  private async emergencyStop(userId: string, payload: any): Promise<any> {
    // Missing flags must never turn a kill-switch command into a session-only
    // stop. This also makes commands created by older API versions fail safe.
    const {
      cancelOrders = true,
      closePositions = true,
      reason = 'Emergency stop',
    } = payload ?? {};

    this.logger.warn({ userId, reason }, 'EMERGENCY STOP triggered');

    // Stop generating new orders before attempting broker-side cleanup.
    this.activeSessions.delete(userId);

    const failures: string[] = [];

    // Cancel all open orders
    if (cancelOrders) {
      try {
        await this.cancelAllOrders(userId);
      } catch (err) {
        failures.push(`cancel orders: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    // Close all positions
    if (closePositions) {
      try {
        await this.closeAllPaperPositions(userId);
      } catch (err) {
        failures.push(`close paper positions: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
      try {
        await this.closeAllLivePositions(userId);
      } catch (err) {
        failures.push(`close live positions: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Emergency stop incomplete: ${failures.join('; ')}`);
    }

    return { emergencyStop: true, reason, closeOrdersRequested: Boolean(closePositions) };
  }

  private async updateRisk(userId: string, payload: any): Promise<any> {
    // Update risk parameters for active sessions
    const session = this.activeSessions.get(userId);
    if (!session) return { updated: false };

    // Apply to generators
    for (const [strategyId, data] of session.paper?.generators || []) {
      data.generator.config.risk = { ...data.generator.config.risk, ...payload };
    }

    return { updated: true };
  }

  private async loadStrategy(strategyId: string): Promise<StrategyConfig | null> {
    const [row] = await this.db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.id, strategyId))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      underlyingSymbol: row.underlyingSymbol,
      timeframe: row.timeframe,
      entryWindow: {
        start: String(row.entryStartTime).slice(0, 5),
        end: String(row.entryEndTime).slice(0, 5),
      },
      exitTime: String(row.exitTime).slice(0, 5),
      executionMode: row.executionMode,
      strikeOffset: row.strikeOffset ?? 5,
      lots: row.lots ?? 1,
      expiryPreference: (row.expiryPreference ?? 'WEEKLY') as 'WEEKLY' | 'MONTHLY',
      avoidExpiryDays: row.avoidExpiryDays ?? 2,
      risk: (row.riskParams ?? {
        maxDailyLossPct: config.defaultRisk.maxDailyLossPct,
        maxPositions: config.defaultRisk.maxPositions,
        maxPositionsPerStrategy: 1,
        perTradeRiskPct: config.defaultRisk.perTradeRiskPct,
        blockedPeriods: ['09:15-09:30', '15:15-15:30'],
        shortOptionStopLossPct: 100,
      }) as StrategyConfig['risk'],
    };
  }

  private async loadInstruments(): Promise<Instrument[]> {
    const rows = await this.db
      .select()
      .from(instrumentsTable)
      .where(eq(instrumentsTable.isActive, true));

    return rows.map((i: any) => ({
      id: i.id,
      symbol: i.symbol,
      instrumentType: i.instrumentType,
      lotSize: i.lotSize,
      tickSize: Number(i.tickSize ?? 0.05),
      strikeStep: i.strikeStep ?? 50,
      underlyingSymbol: i.underlyingSymbol ?? undefined,
      strikePrice: i.strikePrice ? Number(i.strikePrice) : undefined,
      optionType: i.optionType ?? undefined,
      expiryDate: i.expiryDate ? new Date(i.expiryDate) : undefined,
      expiryType: i.expiryType ?? undefined,
      validFrom: new Date(i.validFrom),
      validTo: i.validTo ? new Date(i.validTo) : null,
      growwToken: i.growwToken ?? '',
      isActive: Boolean(i.isActive),
    }));
  }

  private async closeAllPaperPositions(userId: string): Promise<void> {
    const [portfolio] = await this.db
      .select()
      .from(paperPortfolios)
      .where(eq(paperPortfolios.userId, userId))
      .limit(1);

    if (!portfolio) return;

    const openPositions = await this.db
      .select()
      .from(paperPositions)
      .where(and(eq(paperPositions.portfolioId, portfolio.id), isNull(paperPositions.closedAt)));

    let totalRealized = 0;
    for (const pos of openPositions) {
      const entry = Number(pos.avgEntryPrice);
      const exit = pos.currentPrice != null ? Number(pos.currentPrice) : entry;
      const dir = pos.side === 'LONG' ? 1 : -1;
      const pnl = (exit - entry) * pos.quantity * dir;
      totalRealized += pnl;

      await this.db
        .update(paperPositions)
        .set({
          closedAt: new Date(),
          realizedPnl: pnl.toFixed(2),
          closedReason: 'emergency_stop',
        })
        .where(eq(paperPositions.id, pos.id));
    }

    if (openPositions.length > 0) {
      const newCash = Number(portfolio.cashBalance) + totalRealized;
      const newTotal = Number(portfolio.totalValue) + totalRealized;
      await this.db
        .update(paperPortfolios)
        .set({
          cashBalance: newCash.toFixed(2),
          totalValue: newTotal.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(paperPortfolios.id, portfolio.id));
    }
  }

  private async closeAllLivePositions(userId: string): Promise<void> {
    const openPositions = await this.db
      .select()
      .from(livePositions)
      .where(and(eq(livePositions.userId, userId), isNull(livePositions.closedAt)));

    const failures: string[] = [];
    for (const pos of openPositions) {
      const ltp = Number(pos.currentPrice ?? 0);
      if (!Number.isFinite(ltp) || ltp <= 0) {
        failures.push(`${pos.optionSymbol}: no valid current price`);
        continue;
      }

      const [instrument] = await this.db
        .select({ tickSize: instrumentsTable.tickSize })
        .from(instrumentsTable)
        .where(eq(instrumentsTable.growwToken, pos.optionSymbol))
        .limit(1);
      const tickSize = Number(instrument?.tickSize ?? 0);
      if (!Number.isFinite(tickSize) || tickSize <= 0) {
        failures.push(`${pos.optionSymbol}: instrument tick size is unavailable`);
        continue;
      }

      const side = pos.side === 'LONG' ? 'SELL' : 'BUY';
      const protectionPct = Number(process.env['EMERGENCY_LIMIT_BUFFER_PCT'] ?? 1);
      if (!Number.isFinite(protectionPct) || protectionPct <= 0 || protectionPct > 5) {
        failures.push(`${pos.optionSymbol}: EMERGENCY_LIMIT_BUFFER_PCT must be > 0 and <= 5`);
        continue;
      }
      const rawLimitPrice = ltp * (side === 'BUY' ? 1 + protectionPct / 100 : 1 - protectionPct / 100);
      const tickCount = rawLimitPrice / tickSize;
      const limitPrice = (side === 'BUY' ? Math.ceil(tickCount) : Math.floor(tickCount)) * tickSize;

      try {
        await this.growwClient.placeOrder({
          symbol: pos.optionSymbol,
          exchange: 'NFO',
          quantity: pos.quantity,
          side,
          orderType: 'LIMIT',
          price: limitPrice,
          product: 'NRML',
          validity: 'DAY',
        });
      } catch (err) {
        this.logger.error({ err, positionId: pos.id, symbol: pos.optionSymbol }, 'Failed to submit protected close order');
        failures.push(`${pos.optionSymbol}: ${err instanceof Error ? err.message : 'order submission failed'}`);
        continue;
      }

      // A successful order submission is not proof of a fill. Keep the position
      // open until broker fill updates/reconciliation confirm it is flat.
      this.logger.warn({ positionId: pos.id, symbol: pos.optionSymbol, limitPrice }, 'Protected close submitted; awaiting broker fill');
    }
    if (failures.length > 0) {
      throw new Error(failures.join('; '));
    }
  }

  private async cancelAllOrders(userId: string): Promise<void> {
    const pendingOrders = await this.db
      .select()
      .from(liveFills)
      .where(
        and(
          eq(liveFills.userId, userId),
          inArray(liveFills.status, ['PENDING', 'OPEN'])
        )
      );

    const failures: string[] = [];
    for (const order of pendingOrders) {
      if (!order.growwOrderId) {
        failures.push(`cannot cancel ${order.id}: broker order ID is missing`);
        continue;
      }
      try {
        await this.growwClient.cancelOrder(order.growwOrderId);
        await this.db
          .update(liveFills)
          .set({ status: 'CANCELLED', updatedAt: new Date(), completedAt: new Date() })
          .where(eq(liveFills.id, order.id));
      } catch (err) {
        this.logger.error({ err, orderId: order.growwOrderId }, 'Failed to cancel Groww order');
        failures.push(`${order.growwOrderId}: ${err instanceof Error ? err.message : 'cancellation failed'}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(failures.join('; '));
    }
  }

  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  async stopAllSessions(): Promise<void> {
    for (const [userId] of this.activeSessions) {
      await this.emergencyStop(userId, { cancelOrders: true, closePositions: true, reason: 'Engine shutdown' });
    }
  }
}
