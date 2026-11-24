// ============================================
// Reconciliation Service - Crash Recovery
// ============================================

import pino from 'pino';
import { db } from '../index';
import { reconciliationState, liveFills, livePositions, paperPortfolios, paperPositions, paperTrades } from '../../api/src/db/schema';
import { eq, and, isNull, desc, gte, lte } from 'drizzle-orm';
import { GrowwClient } from './groww-client';
import { config } from '../config';

export class ReconciliationService {
  private logger: pino.Logger;

  constructor(private db: any, logger: pino.Logger) {
    this.logger = logger.child({ component: 'ReconciliationService' });
  }

  async reconcileOnStart(userId: string, runType: 'paper' | 'live', growwClient: GrowwClient): Promise<void> {
    this.logger.info({ userId, runType }, 'Starting reconciliation');

    try {
      // 1. Get stored reconciliation state
      const [recState] = await this.db
        .select()
        .from(reconciliationState)
        .where(and(
          eq(reconciliationState.userId, userId),
          eq(reconciliationState.runType, runType)
        ));

      // 2. Get current positions from Groww (for live) or DB (for paper)
      let growwPositions: any[] = [];
      if (runType === 'live') {
        const positions = await growwClient.getPositions();
        growwPositions = positions.data || [];
      }

      // 3. Get open positions from our DB
      const dbPositions = runType === 'live'
        ? await this.getOpenLivePositions(userId)
        : await this.getOpenPaperPositions(userId);

      // 4. Compare and reconcile
      const discrepancies = this.findDiscrepancies(dbPositions, growwPositions, runType);

      // 5. Resolve discrepancies
      for (const disc of discrepancies) {
        await this.resolveDiscrepancy(userId, runType, disc, growwClient);
      }

      // 6. Update reconciliation state
      await this.updateReconciliationState(userId, runType, {
        lastProcessedBar: new Date(),
        openPositionsSnapshot: dbPositions,
        growwPositionsSnapshot: growwPositions,
      });

      this.logger.info({ userId, runType, discrepancies: discrepancies.length }, 'Reconciliation complete');

    } catch (error) {
      this.logger.error({ err: error, userId, runType }, 'Reconciliation failed');
      throw error;
    }
  }

  private async getOpenLivePositions(userId: string): Promise<any[]> {
    return this.db
      .select()
      .from(livePositions)
      .where(and(
        eq(livePositions.userId, userId),
        isNull(livePositions.closedAt)
      ));
  }

  private async getOpenPaperPositions(userId: string): Promise<any[]> {
    const [portfolio] = await this.db
      .select()
      .from(paperPortfolios)
      .where(eq(paperPortfolios.userId, userId));

    if (!portfolio) return [];

    return this.db
      .select()
      .from(paperPositions)
      .where(and(
        eq(paperPositions.portfolioId, portfolio.id),
        isNull(paperPositions.closedAt)
      ));
  }

  private findDiscrepancies(dbPositions: any[], growwPositions: any[], runType: string): any[] {
    const discrepancies: any[] = [];

    // Map by option symbol
    const dbMap = new Map(dbPositions.map(p => [p.optionSymbol, p]));
    const growwMap = new Map(growwPositions.map(p => [p.symbol || p.optionSymbol, p]));

    // Check DB positions against Groww
    for (const [symbol, dbPos] of dbMap) {
      const growwPos = growwMap.get(symbol);
      if (!growwPos) {
        // Position in DB but not in Groww - might be closed
        discrepancies.push({
          type: 'MISSING_IN_GROWW',
          symbol,
          dbPosition: dbPos,
          action: 'VERIFY_AND_CLOSE',
        });
      } else {
        // Compare quantities
        const dbQty = dbPos.quantity;
        const growwQty = growwPos.quantity || growwPos.netQty || 0;
        if (dbQty !== growwQty) {
          discrepancies.push({
            type: 'QUANTITY_MISMATCH',
            symbol,
            dbQuantity: dbQty,
            growwQuantity: growwQty,
            action: 'RECONCILE_QUANTITY',
          });
        }
      }
    }

    // Check Groww positions not in DB
    for (const [symbol, growwPos] of growwMap) {
      if (!dbMap.has(symbol)) {
        discrepancies.push({
          type: 'MISSING_IN_DB',
          symbol,
          growwPosition: growwPos,
          action: 'CREATE_DB_POSITION',
        });
      }
    }

    return discrepancies;
  }

  private async resolveDiscrepancy(userId: string, runType: string, discrepancy: any, growwClient: GrowwClient): Promise<void> {
    this.logger.warn({ userId, runType, discrepancy }, 'Resolving discrepancy');

    switch (discrepancy.action) {
      case 'VERIFY_AND_CLOSE':
        // Check if position was actually closed
        // For now, mark as closed in DB
        if (runType === 'live') {
          await this.db
            .update(livePositions)
            .set({ closedAt: new Date(), realizedPnl: 0 })
            .where(and(
              eq(livePositions.userId, userId),
              eq(livePositions.optionSymbol, discrepancy.symbol),
              isNull(livePositions.closedAt)
            ));
        } else {
          const [portfolio] = await this.db
            .select()
            .from(paperPortfolios)
            .where(eq(paperPortfolios.userId, userId));
          if (portfolio) {
            await this.db
              .update(paperPositions)
              .set({ closedAt: new Date(), realizedPnl: 0 })
              .where(and(
                eq(paperPositions.portfolioId, portfolio.id),
                eq(paperPositions.optionSymbol, discrepancy.symbol),
                isNull(paperPositions.closedAt)
              ));
          }
        }
        break;

      case 'RECONCILE_QUANTITY':
        // Update DB to match Groww
        if (runType === 'live') {
          await this.db
            .update(livePositions)
            .set({ quantity: discrepancy.growwQuantity })
            .where(and(
              eq(livePositions.userId, userId),
              eq(livePositions.optionSymbol, discrepancy.symbol),
              isNull(livePositions.closedAt)
            ));
        }
        break;

      case 'CREATE_DB_POSITION':
        // Create position from Groww data
        if (runType === 'live') {
          await this.db
            .insert(livePositions)
            .values({
              userId,
              optionSymbol: discrepancy.symbol,
              side: discrepancy.growwPosition.side || 'LONG',
              quantity: discrepancy.growwPosition.quantity || 0,
              avgEntryPrice: discrepancy.growwPosition.avgPrice || 0,
              currentPrice: discrepancy.growwPosition.ltp || 0,
              unrealizedPnl: discrepancy.growwPosition.unrealizedPnl || 0,
            });
        }
        break;
    }
  }

  private async updateReconciliationState(userId: string, runType: string, data: any): Promise<void> {
    await this.db
      .insert(reconciliationState)
      .values({
        userId,
        runType,
        ...data,
      })
      .onConflictDoUpdate({
        target: [reconciliationState.userId, reconciliationState.runType],
        set: data,
      });
  }
}