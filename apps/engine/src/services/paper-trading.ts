import pino from 'pino';
import { and, eq, isNull } from 'drizzle-orm';
import {
  calculateTradePnL,
  DEFAULT_COST_CONFIG,
  getLotSize,
  StreamingSignalGenerator,
  type CandleResampled,
  type Instrument,
  type Signal,
} from '@groww-trading/strategy-core';
import {
  paperPortfolios,
  paperPositions,
  paperTrades,
  userProfiles,
  type PaperPortfolio,
} from '../../../api/src/db/schema';
import type { GrowwClient } from './groww-client';
import type { MarketDataService } from './market-data';

export class PaperTradingEngine {
  private logger: pino.Logger;

  constructor(
    private db: any,
    logger: pino.Logger,
    private growwClient: GrowwClient,
    private marketData: MarketDataService
  ) {
    this.logger = logger.child({ component: 'PaperTradingEngine' });
  }

  private async runTx<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    if (this.db && typeof this.db.transaction === 'function') {
      return this.db.transaction(fn);
    }
    return fn(this.db);
  }

  async onBarClose(
    userId: string,
    generator: { processBar: (bar: CandleResampled, prevBar: CandleResampled | null) => Signal[] },
    bar: CandleResampled,
    instruments: Instrument[],
    optionPriceLookup?: (symbol: string, spotPrice: number) => number
  ): Promise<Signal[]> {
    const signals = generator.processBar(bar, null);
    if (signals.length === 0) return signals;

    const [portfolio] = await this.db
      .select()
      .from(paperPortfolios)
      .where(and(eq(paperPortfolios.userId, userId), eq(paperPortfolios.isActive, true)))
      .limit(1);

    if (!portfolio) {
      this.logger.warn({ userId }, 'No paper portfolio found for user');
      return signals;
    }

    for (const sig of signals) {
      const isExit = Boolean(sig.metadata['isExit']);
      if (isExit) {
        await this.closePosition(portfolio, sig, optionPriceLookup);
      } else {
        const allowed = await this.checkRiskLimits(userId, portfolio);
        if (!allowed) {
          this.logger.warn({ userId, symbol: sig.optionSymbol }, 'Paper entry blocked by risk limits');
          continue;
        }
        await this.openPosition(portfolio, sig, instruments, optionPriceLookup);
      }
    }

    return signals;
  }

  async updateMarkToMarket(
    userId: string,
    pricesBySymbol: Map<string, number>
  ): Promise<void> {
    const [portfolio] = await this.db
      .select()
      .from(paperPortfolios)
      .where(and(eq(paperPortfolios.userId, userId), eq(paperPortfolios.isActive, true)))
      .limit(1);

    if (!portfolio) return;

    const openPositions = await this.db
      .select()
      .from(paperPositions)
      .where(and(eq(paperPositions.portfolioId, portfolio.id), isNull(paperPositions.closedAt)));

    let totalUnrealized = 0;
    for (const pos of openPositions) {
      const ltp = pricesBySymbol.get(pos.optionSymbol);
      if (ltp === undefined) continue;
      const entry = Number(pos.avgEntryPrice);
      const dir = pos.side === 'LONG' ? 1 : -1;
      const unrealized = (ltp - entry) * pos.quantity * dir;
      totalUnrealized += unrealized;

      await this.db
        .update(paperPositions)
        .set({
          currentPrice: ltp.toFixed(4),
          unrealizedPnl: unrealized.toFixed(2),
        })
        .where(eq(paperPositions.id, pos.id));
    }

    const totalValue = Number(portfolio.cashBalance) + totalUnrealized;
    await this.db
      .update(paperPortfolios)
      .set({
        totalValue: totalValue.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(paperPortfolios.id, portfolio.id));
  }

  private async checkRiskLimits(userId: string, portfolio: PaperPortfolio): Promise<boolean> {
    const [profile] = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    const limits = (profile?.riskLimits ?? {}) as {
      maxDailyLossPct?: number;
      maxPositions?: number;
    };
    const maxDailyLossPct = limits.maxDailyLossPct ?? 2;
    const maxPositions = limits.maxPositions ?? 3;

    const dayStart = Number(portfolio.dayStartValue ?? portfolio.cashBalance);
    const dailyPnl = Number(portfolio.dailyPnl ?? 0);
    if (dayStart > 0 && dailyPnl <= -(dayStart * (maxDailyLossPct / 100))) {
      return false;
    }

    const openPositions = await this.db
      .select({ id: paperPositions.id })
      .from(paperPositions)
      .where(and(eq(paperPositions.portfolioId, portfolio.id), isNull(paperPositions.closedAt)));

    return openPositions.length < maxPositions;
  }

  private async openPosition(
    portfolio: PaperPortfolio,
    sig: Signal,
    instruments: Instrument[],
    optionPriceLookup?: (symbol: string, spotPrice: number) => number
  ): Promise<void> {
    const isEquityCash = sig.metadata['assetClass'] === 'EQUITY_CASH';
    const underlying = String(sig.metadata['underlyingSymbol'] ?? 'NIFTY');
    const lots = Math.max(1, Number(sig.metadata['lots'] ?? 1));
    const quantity = isEquityCash
      ? lots
      : getLotSize(instruments, underlying, 'OPT', sig.selectedStrike, sig.optionType) * lots;
    const fillPrice = optionPriceLookup
      ? optionPriceLookup(sig.optionSymbol, sig.spotPrice)
      : isEquityCash
        ? sig.spotPrice
        : Math.max(5, Math.abs(sig.spotPrice - sig.selectedStrike) + 100);

    await this.runTx(async (tx) => {
      await tx.insert(paperPositions).values({
        portfolioId: portfolio.id,
        optionSymbol: sig.optionSymbol,
        side: sig.signalType === 'BUY' ? 'LONG' : 'SHORT',
        quantity,
        avgEntryPrice: fillPrice.toFixed(4),
        currentPrice: fillPrice.toFixed(4),
        unrealizedPnl: '0',
        realizedPnl: '0',
      });

      await tx.insert(paperTrades).values({
        portfolioId: portfolio.id,
        optionSymbol: sig.optionSymbol,
        side: sig.signalType,
        entryTime: sig.barTime,
        entryPrice: fillPrice.toFixed(4),
        quantity,
        fillMetadata: { simulated: true, spotPrice: sig.spotPrice },
      });
    });

    this.logger.info(
      { symbol: sig.optionSymbol, side: sig.signalType, fillPrice, quantity },
      'Paper position opened'
    );
  }

  private async closePosition(
    portfolio: PaperPortfolio,
    sig: Signal,
    optionPriceLookup?: (symbol: string, spotPrice: number) => number
  ): Promise<void> {
    const [openPos] = await this.db
      .select()
      .from(paperPositions)
      .where(
        and(
          eq(paperPositions.portfolioId, portfolio.id),
          eq(paperPositions.optionSymbol, sig.optionSymbol),
          isNull(paperPositions.closedAt)
        )
      )
      .limit(1);

    if (!openPos) return;

    const exitPrice = optionPriceLookup
      ? optionPriceLookup(openPos.optionSymbol, sig.spotPrice)
      : Number(openPos.currentPrice ?? openPos.avgEntryPrice);

    const pnl = calculateTradePnL(
      DEFAULT_COST_CONFIG,
      Number(openPos.avgEntryPrice),
      exitPrice,
      openPos.quantity,
      openPos.side
    );

    await this.runTx(async (tx) => {
      await tx
        .update(paperPositions)
        .set({
          closedAt: sig.barTime,
          currentPrice: exitPrice.toFixed(4),
          realizedPnl: pnl.netPnl.toFixed(2),
          unrealizedPnl: '0',
          closedReason: String(sig.metadata['exitReason'] ?? 'signal'),
        })
        .where(eq(paperPositions.id, openPos.id));

      const newCash = Number(portfolio.cashBalance) + pnl.netPnl;
      const newDailyPnl = Number(portfolio.dailyPnl ?? 0) + pnl.netPnl;

      await tx
        .update(paperPortfolios)
        .set({
          cashBalance: newCash.toFixed(2),
          totalValue: newCash.toFixed(2),
          dailyPnl: newDailyPnl.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(paperPortfolios.id, portfolio.id));
    });

    this.logger.info(
      { symbol: openPos.optionSymbol, netPnl: pnl.netPnl.toFixed(2) },
      'Paper position closed'
    );
  }
}
