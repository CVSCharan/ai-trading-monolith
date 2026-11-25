import { describe, expect, test } from 'bun:test';
import { runBacktest } from '../src/backtest/engine';
import { formatBacktestReport } from '../src/backtest/reporter';
import { calculateTradePnL, HISTORICAL_COST_CONFIGS } from '../src/execution/cost-calculator';
import { createInstruments, createStrategyConfig, createUTCForIST } from './test-utils';
import type { BacktestConfig, CandleResampled } from '../src/types';

function buildMultiDayCandles(): CandleResampled[] {
  const candles: CandleResampled[] = [];
  const days = [15, 16, 17, 18, 19]; // 5 trading days in Jan 2024

  for (let d = 0; d < days.length; d++) {
    const day = days[d]!;
    // 23 fifteen-minute bars per day (09:15 to 14:45 open -> 15:00 close)
    for (let i = 0; i < 23; i++) {
      const totalMin = 9 * 60 + 15 + i * 15;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      let close = 23985;
      if (d === 0 && i < 21) {
        close = 23995 - i * 0.5; // Warmup descending so EMA9 < EMA21
      } else if (d >= 1 && i >= 2 && i <= 10) {
        close = 24024; // Bullish spike inside 09:30-11:30 window
      } else if (d >= 1 && i > 10) {
        close = 23980; // Bearish pullback for opposite crossover or 15:00 square-off
      }
      candles.push({
        instrumentId: 1,
        timeframe: '15m',
        barTime: createUTCForIST(2024, 1, day, h, m),
        open: close,
        high: close + 2,
        low: close - 2,
        close,
        volume: 10000,
      });
    }
  }
  return candles;
}

describe('Backtest Engine, Metrics & Reporter (S2-004..S2-006, S2-008)', () => {
  const btConfig: BacktestConfig = {
    strategyId: 'test-strategy',
    startDate: createUTCForIST(2024, 1, 15, 9, 15),
    endDate: createUTCForIST(2024, 1, 19, 15, 30),
    initialCapital: 1_000_000,
    configSnapshot: createStrategyConfig(),
  };

  test('runs 5-day backtest and produces trades, equity curve, and metrics', () => {
    const result = runBacktest(btConfig, buildMultiDayCandles(), createInstruments());

    expect(result.totalTrades).toBeGreaterThan(0);
    expect(result.equityCurve.length).toBe(result.totalTrades + 1);
    expect(result.dailyReturns.length).toBeGreaterThan(0);
    expect(result.finalCapital).toBeCloseTo(btConfig.initialCapital + result.netPnl, 4);

    const report = formatBacktestReport(result);
    expect(report.summary.totalTrades).toBe(result.totalTrades);
  });

  test('EMA is continuous across day boundaries (trades fire on Day 2 without 21-bar reset)', () => {
    const candles = buildMultiDayCandles();
    const result = runBacktest(btConfig, candles, createInstruments());
    // Day 2 morning spike (bar index 2 of Day 2) can only fire if EMAs carried over from Day 1
    const day2Trades = result.trades.filter(
      (t) => t.entryTime.getUTCDate() === 16
    );
    expect(day2Trades.length).toBeGreaterThan(0);
  });

  test('P&L and costs match manual calculateTradePnL calculation', () => {
    const fixedPrices = new Map<string, number>();
    const result = runBacktest(
      btConfig,
      buildMultiDayCandles(),
      createInstruments(),
      (_sym, barTime) => {
        const key = barTime.toISOString();
        const price = fixedPrices.get(key) ?? (barTime.getUTCHours() < 5 ? 120 : 150);
        fixedPrices.set(key, price);
        return price;
      },
      HISTORICAL_COST_CONFIGS
    );

    expect(result.trades.length).toBeGreaterThan(0);
    const first = result.trades[0]!;
    const manual = calculateTradePnL(
      HISTORICAL_COST_CONFIGS[0]!,
      first.entryPrice,
      first.exitPrice!,
      first.quantity,
      first.side
    );
    expect(first.grossPnl).toBeCloseTo(manual.grossPnl, 4);
    expect(first.costs).toBeCloseTo(manual.totalCosts, 4);
    expect(first.netPnl).toBeCloseTo(manual.netPnl, 4);
  });

  test('15:00 square-off closes open position when no opposite crossover occurs', () => {
    const candles: CandleResampled[] = [];
    for (let i = 0; i < 21; i++) {
      const totalMin = 9 * 60 + 15 + i * 15;
      candles.push({
        instrumentId: 1,
        timeframe: '15m',
        barTime: createUTCForIST(2024, 1, 15, Math.floor(totalMin / 60), totalMin % 60),
        open: 23995 - i * 0.5,
        high: 23995,
        low: 23980,
        close: 23995 - i * 0.5,
        volume: 1000,
      });
    }
    // Day 2: bullish cross at 09:30, stays flat until 14:45 (15:00 close)
    candles.push({
      instrumentId: 1,
      timeframe: '15m',
      barTime: createUTCForIST(2024, 1, 16, 9, 30),
      open: 24024,
      high: 24025,
      low: 24020,
      close: 24024,
      volume: 1000,
    });
    candles.push({
      instrumentId: 1,
      timeframe: '15m',
      barTime: createUTCForIST(2024, 1, 16, 14, 45),
      open: 24024,
      high: 24025,
      low: 24020,
      close: 24024,
      volume: 1000,
    });

    const result = runBacktest(btConfig, candles, createInstruments());
    expect(result.trades.length).toBe(1);
    expect(result.trades[0]?.exitReason).toBe('SQUARE_OFF_1500');
  });

  test('empty candle array produces zero trades and intact initial capital', () => {
    const result = runBacktest(btConfig, [], createInstruments());
    expect(result.totalTrades).toBe(0);
    expect(result.netPnl).toBe(0);
    expect(result.finalCapital).toBe(btConfig.initialCapital);
    expect(result.maxDrawdown).toBe(0);
  });
});
