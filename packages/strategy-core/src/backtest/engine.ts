import {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  CandleResampled,
  CostConfig,
  ExitReason,
  Instrument,
  Signal,
} from '../types';
import { StreamingSignalGenerator } from '../signals/generator';
import { buildInstrumentIndex, getLotSize } from '../execution/instrument-resolver';
import {
  calculateTradePnL,
  getCostConfigForDate,
  HISTORICAL_COST_CONFIGS,
} from '../execution/cost-calculator';
import { calculateBacktestMetrics } from './metrics';
import { buildDailyReturns, buildEquityCurve } from './reporter';

export type OptionPriceLookup = (
  optionSymbol: string,
  barTime: Date,
  spotPrice: number
) => number;

interface OpenPositionState {
  optionSymbol: string;
  side: 'LONG' | 'SHORT';
  entryTime: Date;
  entryPrice: number;
  quantity: number;
  strike: number;
  optionType: 'CE' | 'PE';
}

/**
 * Default deterministic option premium estimator when option tick/bar series is omitted in tests.
 */
function defaultOptionPriceLookup(
  _symbol: string,
  _barTime: Date,
  spotPrice: number,
  strike: number = 0,
  optionType: 'CE' | 'PE' = 'CE'
): number {
  const intrinsic =
    optionType === 'CE'
      ? Math.max(0, spotPrice - strike)
      : Math.max(0, strike - spotPrice);
  return Math.max(5, intrinsic + 100);
}

/**
 * Run deterministic backtest over resampled spot candles.
 * Preserves EMA continuity across day boundaries (no daily reset).
 */
export function runBacktest(
  config: BacktestConfig,
  spotCandles: CandleResampled[],
  instruments: Instrument[],
  optionPriceLookup?: OptionPriceLookup,
  costConfigs: CostConfig[] = HISTORICAL_COST_CONFIGS
): BacktestResult {
  // Pre-build O(1) instrument index (S2-007)
  buildInstrumentIndex(instruments);

  const strategyConfig = config.configSnapshot;
  const generator = new StreamingSignalGenerator(
    strategyConfig,
    instruments,
    'backtest'
  );

  const trades: BacktestTrade[] = [];
  let openPos: OpenPositionState | null = null;
  let tradeCounter = 0;

  const sortedCandles = [...spotCandles].sort(
    (a, b) => a.barTime.getTime() - b.barTime.getTime()
  );

  for (const bar of sortedCandles) {
    const barSignals: Signal[] = generator.processBar(bar, null);

    for (const sig of barSignals) {
      const isExit = Boolean(sig.metadata['isExit']);

      if (isExit && openPos) {
        const exitPrice = optionPriceLookup
          ? optionPriceLookup(openPos.optionSymbol, sig.barTime, sig.spotPrice)
          : defaultOptionPriceLookup(
              openPos.optionSymbol,
              sig.barTime,
              sig.spotPrice,
              openPos.strike,
              openPos.optionType
            );

        const datedCost = getCostConfigForDate(sig.barTime, costConfigs);
        const pnl = calculateTradePnL(
          datedCost,
          openPos.entryPrice,
          exitPrice,
          openPos.quantity,
          openPos.side
        );

        tradeCounter++;
        const exitReason =
          (sig.metadata['exitReason'] as ExitReason | undefined) ??
          'OPPOSITE_CROSSOVER';

        trades.push({
          tradeNum: tradeCounter,
          optionSymbol: openPos.optionSymbol,
          side: openPos.side,
          entryTime: openPos.entryTime,
          entryPrice: openPos.entryPrice,
          exitTime: sig.barTime,
          exitPrice,
          quantity: openPos.quantity,
          grossPnl: pnl.grossPnl,
          costs: pnl.totalCosts,
          netPnl: pnl.netPnl,
          exitReason,
          fillMetadata: {
            bid: exitPrice,
            ask: exitPrice,
            spread: 0,
            slippage: pnl.entryCosts.slippage + pnl.exitCosts.slippage,
          },
          metadata: {
            ema9: sig.ema9,
            ema21: sig.ema21,
          },
        });

        openPos = null;
      } else if (!isExit && !openPos) {
        const lotSize = getLotSize(
          instruments,
          strategyConfig.underlyingSymbol,
          'OPT',
          sig.selectedStrike,
          sig.optionType
        );
        const quantity = strategyConfig.lots * lotSize;
        const entryPrice = optionPriceLookup
          ? optionPriceLookup(sig.optionSymbol, sig.barTime, sig.spotPrice)
          : defaultOptionPriceLookup(
              sig.optionSymbol,
              sig.barTime,
              sig.spotPrice,
              sig.selectedStrike,
              sig.optionType
            );

        openPos = {
          optionSymbol: sig.optionSymbol,
          side: sig.signalType === 'BUY' ? 'LONG' : 'SHORT',
          entryTime: sig.barTime,
          entryPrice,
          quantity,
          strike: sig.selectedStrike,
          optionType: sig.optionType,
        };
      }
    }
  }

  const equityCurve = buildEquityCurve(
    trades,
    config.initialCapital,
    config.startDate
  );
  const dailyReturns = buildDailyReturns(trades, config.initialCapital);
  const metrics = calculateBacktestMetrics(
    trades,
    equityCurve,
    dailyReturns,
    config.initialCapital
  );

  return {
    runId: `bt-${config.strategyId}-${Date.now()}`,
    ...metrics,
    trades,
    equityCurve,
    dailyReturns,
  };
}
