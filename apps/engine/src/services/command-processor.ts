// ============================================
// Command Processor - Handles API commands
// ============================================

import pino from 'pino';
import { db } from '../index';
import { engineCommands, engineState, reconciliationState } from '../db/command-state';
import { paperPortfolios, paperPositions, paperTrades } from '../../api/src/db/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { GrowwClient } from './groww-client';
import { StreamingSignalGenerator } from '@groww-trading/strategy-core';
import { config } from '../config';

export class CommandProcessor {
  private logger: pino.Logger;
  private activeSessions: Map<string, { paper?: any; live?: any }> = new Map();
  private errorCount = 0;

  constructor(
    private db: any,
    logger: pino.Logger,
    private growwClient: GrowwClient
  ) {
    this.logger = logger.child({ component: 'CommandProcessor' });
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
      generators.set(strategyId, { generator, strategy, position: null });
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
    const { strategyIds, twoFactorVerified } = payload;

    if (!twoFactorVerified) {
      throw new Error('2FA verification required for live trading');
    }

    // Check user has live trading enabled in profile
    // (This would be verified by API before sending command)

    // Initialize live trading engine
    // Similar to paper but with real orders
    const generators = new Map();
    for (const strategyId of strategyIds) {
      const strategy = await this.loadStrategy(strategyId);
      if (!strategy) continue;

      const instruments = await this.loadInstruments();
      const generator = new StreamingSignalGenerator(strategy, instruments, 'live');
      generators.set(strategyId, { generator, strategy, position: null });
    }

    this.activeSessions.set(userId, { ...this.activeSessions.get(userId), live: { generators } });

    return { enabled: true, strategies: strategyIds };
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
    const { cancelOrders, closePositions, reason } = payload;

    this.logger.warn({ userId, reason }, 'EMERGENCY STOP triggered');

    // Cancel all open orders
    if (cancelOrders) {
      await this.cancelAllOrders(userId);
    }

    // Close all positions
    if (closePositions) {
      await this.closeAllPaperPositions(userId);
      await this.closeAllLivePositions(userId);
    }

    // Stop all sessions
    this.activeSessions.delete(userId);

    return { emergencyStop: true, reason };
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

  private async loadStrategy(strategyId: string): Promise<any> {
    // Load from database
    return null; // Placeholder
  }

  private async loadInstruments(): Promise<any[]> {
    // Load from database
    return []; // Placeholder
  }

  private async closeAllPaperPositions(portfolioId: string): Promise<void> {
    // Implementation
  }

  private async closeAllLivePositions(userId: string): Promise<void> {
    // Implementation
  }

  private async cancelAllOrders(userId: string): Promise<void> {
    // Implementation
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