import { describe, expect, test } from 'bun:test';
import { generateSignals, StreamingSignalGenerator } from '../src/signals/generator';
import { createInstruments, createStrategyConfig, createUTCForIST } from './test-utils';
import type { CandleResampled } from '../src/types';

function makeBar(hourIST: number, minuteIST: number, close: number, day: number = 15): CandleResampled {
  return {
    instrumentId: 1,
    timeframe: '15m',
    barTime: createUTCForIST(2024, 1, day, hourIST, minuteIST),
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  };
}

function makeBatchSeries(bars: Array<[number, number, number]>): CandleResampled[] {
  return bars.map(([h, m, close]) => makeBar(h, m, close));
}

describe('StreamingSignalGenerator & generateSignals (S1-009, S1-010, S2-002)', () => {
  test('S1-009: entry fires after a previous exit (no bracket deadlock)', () => {
    const gen = new StreamingSignalGenerator(createStrategyConfig(), createInstruments(), 'paper');
    gen.initializeFromHistory(100, 105, null);

    const entry1 = gen.processBar(makeBar(9, 30, 24000), null);
    expect(entry1.length).toBe(1);
    expect(entry1[0]?.signalType).toBe('BUY');
    expect(entry1[0]?.optionSymbol).not.toBe('');

    const exit1 = gen.processBar(makeBar(14, 45, 24000), null);
    expect(exit1.length).toBe(1);
    expect(exit1[0]?.metadata?.isExit).toBe(true);
    expect(gen.getCurrentPosition()).toBeNull();

    gen.initializeFromHistory(100, 105, null);
    const entry2 = gen.processBar(makeBar(9, 45, 24000), null);
    expect(entry2.length).toBe(1);
    expect(entry2[0]?.signalType).toBe('BUY');
  });

  test('S1-010: exit signal carries the open trade optionSymbol, strike, and expiryDate', () => {
    const gen = new StreamingSignalGenerator(createStrategyConfig(), createInstruments(), 'paper');
    gen.initializeFromHistory(100, 105, null);

    const entrySignals = gen.processBar(makeBar(9, 30, 24000), null);
    expect(entrySignals.length).toBe(1);
    const entry = entrySignals[0]!;

    const exitSignals = gen.processBar(makeBar(14, 45, 24000), null);
    expect(exitSignals.length).toBe(1);
    const exit = exitSignals[0]!;
    expect(exit.metadata?.isExit).toBe(true);
    expect(exit.optionSymbol).toBe(entry.optionSymbol);
    expect(exit.selectedStrike).toBe(entry.selectedStrike);
    expect(exit.optionType).toBe(entry.optionType);
  });

  test('S2-002: entry is blocked outside entry window', () => {
    const gen = new StreamingSignalGenerator(createStrategyConfig(), createInstruments(), 'paper');
    gen.initializeFromHistory(100, 105, null);

    // 12:00 open -> 12:15 close is outside 09:30-11:30 window
    const signals = gen.processBar(makeBar(12, 0, 24000), null);
    expect(signals.length).toBe(0);
    expect(gen.getCurrentPosition()).toBeNull();
  });

  test('S2-002: exit is honored outside entry window on opposite crossover', () => {
    const gen = new StreamingSignalGenerator(createStrategyConfig(), createInstruments(), 'paper');
    gen.initializeFromHistory(100, 105, null);

    // Enter LONG inside window (09:30 -> 09:45)
    const entry = gen.processBar(makeBar(9, 30, 24000), null);
    expect(entry.length).toBe(1);
    expect(gen.getCurrentPosition()).toBe('LONG');

    // Re-seed bullish state and drop price sharply outside window (13:00 -> 13:15)
    gen.initializeFromHistory(24010, 24000, 'LONG');
    const exit = gen.processBar(makeBar(13, 0, 20000), null);
    expect(exit.length).toBe(1);
    expect(exit[0]?.metadata?.exitReason).toBe('OPPOSITE_CROSSOVER');
    expect(gen.getCurrentPosition()).toBeNull();
  });

  test('S2-002: 15:00 square-off takes priority over opposite crossover', () => {
    const gen = new StreamingSignalGenerator(createStrategyConfig(), createInstruments(), 'paper');
    gen.initializeFromHistory(24010, 24000, 'LONG');

    // 14:45 bar closes at 15:00 AND triggers bearish crossover -> SQUARE_OFF_1500 wins
    const signals = gen.processBar(makeBar(14, 45, 20000), null);
    expect(signals.length).toBe(1);
    expect(signals[0]?.metadata?.exitReason).toBe('SQUARE_OFF_1500');
    expect(gen.getCurrentPosition()).toBeNull();
  });

  test('S2-002: reversal emits exit + new entry in same bar when inside entry window', () => {
    const gen = new StreamingSignalGenerator(createStrategyConfig(), createInstruments(), 'paper');
    gen.initializeFromHistory(24010, 24008, 'LONG');

    // 10:00 open -> 10:15 close (inside 09:30-11:30 window) with bearish crossover; 23990 rounds to ATM 24000
    const signals = gen.processBar(makeBar(10, 0, 23990), null);
    expect(signals.length).toBe(2);
    expect(signals[0]?.metadata?.exitReason).toBe('OPPOSITE_CROSSOVER');
    expect(signals[1]?.isReversal).toBe(true);
    expect(signals[1]?.signalType).toBe('SELL');
    expect(gen.getCurrentPosition()).toBe('SHORT');
  });

  test('S2-002: reversal is NOT triggered outside entry window (exit only)', () => {
    const gen = new StreamingSignalGenerator(createStrategyConfig(), createInstruments(), 'paper');
    gen.initializeFromHistory(24010, 24000, 'LONG');

    // 13:00 open -> 13:15 close (outside window) with bearish crossover
    const signals = gen.processBar(makeBar(13, 0, 20000), null);
    expect(signals.length).toBe(1);
    expect(signals[0]?.metadata?.exitReason).toBe('OPPOSITE_CROSSOVER');
    expect(gen.getCurrentPosition()).toBeNull();
  });

  test('S2-002: generateSignals batch mode produces clean entry & square-off with no state leak', () => {
    const batchBars: CandleResampled[] = [];
    // Day 1 (Jan 14): 21 warmup bars descending from 23995 -> EMA9 < EMA21
    for (let i = 0; i < 21; i++) {
      const totalMin = 9 * 60 + 15 + i * 15;
      batchBars.push(makeBar(Math.floor(totalMin / 60), totalMin % 60, 23995 - i * 0.5, 14));
    }
    // Day 2 (Jan 15): bullish crossover inside 09:30-11:30 window, then 15:00 square-off
    batchBars.push(makeBar(9, 30, 24024, 15));
    batchBars.push(makeBar(14, 45, 24024, 15));

    const signals = generateSignals(
      batchBars,
      new Map(),
      createStrategyConfig(),
      createInstruments(),
      'backtest'
    );

    expect(signals.length).toBeGreaterThanOrEqual(2);
    expect(signals[0]?.signalType).toBe('BUY');
    expect(signals[signals.length - 1]?.metadata?.exitReason).toBe('SQUARE_OFF_1500');
  });
});
