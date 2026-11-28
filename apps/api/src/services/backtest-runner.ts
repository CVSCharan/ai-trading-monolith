import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  runBacktest,
  type BacktestConfig,
  type CandleResampled,
  type Instrument,
  type StrategyConfig,
} from '@groww-trading/strategy-core';
import { db } from '../db';
import {
  backtestRuns,
  backtestTrades,
  candlesResampled,
  instruments,
  strategies,
} from '../db/schema';
import { logger } from '../logger';

const MAX_CONCURRENT = 2;
const POLL_INTERVAL_MS = 3000;

let activeCount = 0;
let timer: ReturnType<typeof setInterval> | null = null;

async function processNextQueuedBacktest(): Promise<void> {
  if (activeCount >= MAX_CONCURRENT) return;

  // Atomically claim the oldest queued job using FOR UPDATE SKIP LOCKED (GAP-30)
  const claimed = await db.transaction(async (tx) => {
    const rows = await tx.execute(sql`
      UPDATE backtest_runs
      SET status = 'running', started_at = NOW()
      WHERE id = (
        SELECT id FROM backtest_runs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, strategy_id AS "strategyId", start_date AS "startDate", end_date AS "endDate", initial_capital AS "initialCapital"
    `);
    return rows[0] as
      | { id: string; strategyId: string; startDate: string; endDate: string; initialCapital: string }
      | undefined;
  });

  if (!claimed) return;
  const job = claimed;

  activeCount++;
  try {

    const [strategy] = await db
      .select()
      .from(strategies)
      .where(eq(strategies.id, job.strategyId))
      .limit(1);

    if (!strategy) {
      throw new Error(`Strategy ${job.strategyId} not found`);
    }

    const activeInstruments = await db
      .select()
      .from(instruments)
      .where(eq(instruments.isActive, true));

    const indexInst = activeInstruments.find(
      (i) => i.symbol === strategy.underlyingSymbol && i.instrumentType === 'INDEX'
    );
    if (!indexInst) {
      throw new Error(`Index instrument not found for ${strategy.underlyingSymbol}`);
    }

    const startDt = new Date(`${job.startDate}T00:00:00.000+05:30`);
    const endDt = new Date(`${job.endDate}T23:59:59.999+05:30`);

    const dbCandles = await db
      .select()
      .from(candlesResampled)
      .where(
        and(
          eq(candlesResampled.instrumentId, indexInst.id),
          eq(candlesResampled.timeframe, strategy.timeframe),
          gte(candlesResampled.barTime, startDt),
          lte(candlesResampled.barTime, endDt)
        )
      )
      .orderBy(asc(candlesResampled.barTime));

    const spotCandles: CandleResampled[] = dbCandles.map((c) => ({
      instrumentId: c.instrumentId,
      timeframe: c.timeframe,
      barTime: c.barTime,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: c.volume,
      oi: c.oi ?? undefined,
    }));

    const mappedInstruments: Instrument[] = activeInstruments.map((i) => ({
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
      expiryType: (i.expiryType ?? undefined) as Instrument['expiryType'],
      validFrom: new Date(i.validFrom),
      validTo: i.validTo ? new Date(i.validTo) : null,
      growwToken: i.growwToken ?? '',
      isActive: Boolean(i.isActive),
    }));

    const strategyConfig: StrategyConfig = {
      id: strategy.id,
      name: strategy.name,
      underlyingSymbol: strategy.underlyingSymbol as StrategyConfig['underlyingSymbol'],
      timeframe: strategy.timeframe,
      entryWindow: {
        start: strategy.entryStartTime.slice(0, 5),
        end: strategy.entryEndTime.slice(0, 5),
      },
      exitTime: strategy.exitTime.slice(0, 5),
      executionMode: strategy.executionMode,
      strikeOffset: strategy.strikeOffset ?? 5,
      lots: strategy.lots ?? 1,
      expiryPreference: (strategy.expiryPreference ?? 'WEEKLY') as 'WEEKLY' | 'MONTHLY',
      avoidExpiryDays: strategy.avoidExpiryDays ?? 2,
      risk: (strategy.riskParams ?? {
        maxDailyLossPct: 2,
        maxPositions: 3,
        maxPositionsPerStrategy: 1,
        perTradeRiskPct: 1,
        blockedPeriods: ['09:15-09:30', '15:15-15:30'],
        shortOptionStopLossPct: 100,
      }) as StrategyConfig['risk'],
    };

    const btConfig: BacktestConfig = {
      strategyId: strategy.id,
      startDate: startDt,
      endDate: endDt,
      initialCapital: Number(job.initialCapital),
      configSnapshot: strategyConfig,
    };

    const result = runBacktest(btConfig, spotCandles, mappedInstruments);

    if (result.trades.length > 0) {
      await db.insert(backtestTrades).values(
        result.trades.map((t) => ({
          backtestRunId: job.id,
          tradeNum: t.tradeNum,
          symbol: strategy.underlyingSymbol,
          optionSymbol: t.optionSymbol,
          side: t.side,
          entryTime: t.entryTime,
          entryPrice: t.entryPrice.toFixed(4),
          exitTime: t.exitTime ?? null,
          exitPrice: t.exitPrice !== undefined ? t.exitPrice.toFixed(4) : null,
          quantity: t.quantity,
          grossPnl: t.grossPnl !== undefined ? t.grossPnl.toFixed(2) : null,
          costs: t.costs !== undefined ? t.costs.toFixed(2) : null,
          netPnl: t.netPnl !== undefined ? t.netPnl.toFixed(2) : null,
          exitReason: t.exitReason ?? null,
          metadata: t.metadata,
        }))
      );
    }

    await db
      .update(backtestRuns)
      .set({
        status: 'completed',
        finalCapital: result.finalCapital.toFixed(2),
        totalTrades: result.totalTrades,
        winningTrades: result.winningTrades,
        losingTrades: result.losingTrades,
        maxDrawdown: (result.maxDrawdown * 100).toFixed(2),
        sharpeRatio: result.sharpeRatio.toFixed(4),
        sortinoRatio: result.sortinoRatio.toFixed(4),
        calmarRatio: result.calmarRatio.toFixed(4),
        profitFactor: Number.isFinite(result.profitFactor)
          ? result.profitFactor.toFixed(4)
          : '999.9999',
        winRate: (result.winRate * 100).toFixed(2),
        avgWin: result.avgWin.toFixed(2),
        avgLoss: result.avgLoss.toFixed(2),
        maxConsecutiveWins: result.maxConsecutiveWins,
        maxConsecutiveLosses: result.maxConsecutiveLosses,
        completedAt: new Date(),
      })
      .where(eq(backtestRuns.id, job.id));

    logger.info({ runId: job.id, trades: result.totalTrades }, 'Backtest completed');
  } catch (err) {
    logger.error({ err, runId: job.id }, 'Backtest execution failed');
    await db
      .update(backtestRuns)
      .set({
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        completedAt: new Date(),
      })
      .where(eq(backtestRuns.id, job.id));
  } finally {
    activeCount--;
  }
}

export function startBacktestWorker(): void {
  if (timer) return;
  timer = setInterval(() => {
    void processNextQueuedBacktest();
  }, POLL_INTERVAL_MS);
  logger.info('Backtest background worker started');
}

export function stopBacktestWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
