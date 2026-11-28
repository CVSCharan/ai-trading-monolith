import { describe, expect, test } from 'bun:test';
import {
  calculateRSI,
  calculateSessionVWAP,
  MultiStrategyEvaluator,
} from '../src/signals/multi-strategy';
import type { CandleResampled } from '../src/types';

function makeBar(isoIst: string, open: number, high: number, low: number, close: number, volume = 1000): CandleResampled {
  return {
    instrumentId: 1,
    timeframe: '15m',
    barTime: new Date(isoIst),
    open,
    high,
    low,
    close,
    volume,
  };
}

describe('MultiStrategyEvaluator (ORB, VWAP, RSI & Equity Cash)', () => {
  test('ORB_BREAKOUT enters LONG on breakout above opening range and squares off at 15:00 IST', () => {
    const evaluator = new MultiStrategyEvaluator('ORB_BREAKOUT', 'EQUITY_CASH', 'RELIANCE');

    // 09:15 IST sets opening range [2900, 2940]
    expect(evaluator.processBar(makeBar('2026-03-18T09:15:00+05:30', 2910, 2940, 2900, 2930))).toEqual([]);

    // 09:30 IST breaks above 2940
    const entries = evaluator.processBar(makeBar('2026-03-18T09:30:00+05:30', 2932, 2955, 2930, 2950));
    expect(entries.length).toBe(1);
    expect(entries[0]?.action).toBe('ENTER');
    expect(entries[0]?.signalType).toBe('BUY');
    expect(entries[0]?.assetClass).toBe('EQUITY_CASH');
    expect(entries[0]?.symbol).toBe('RELIANCE');

    // 15:00 IST forces intraday square-off
    const exits = evaluator.processBar(makeBar('2026-03-18T15:00:00+05:30', 2960, 2965, 2955, 2962));
    expect(exits.length).toBe(1);
    expect(exits[0]?.action).toBe('EXIT');
    expect(exits[0]?.signalType).toBe('SELL');
  });

  test('calculateSessionVWAP and calculateRSI compute finite values', () => {
    const bars = Array.from({ length: 20 }, (_, i) =>
      makeBar(`2026-03-18T09:${String(15 + i).padStart(2, '0')}:00+05:30`, 100 + i, 102 + i, 99 + i, 101 + i, 500)
    );
    const vwap = calculateSessionVWAP(bars);
    expect(Number.isFinite(vwap[19])).toBe(true);

    const rsi = calculateRSI(bars.map((b) => b.close), 14);
    expect(rsi[14]).toBeGreaterThan(90);
  });
});
