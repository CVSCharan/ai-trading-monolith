import { describe, expect, test } from 'bun:test';
import { StreamingSignalGenerator } from '../src/signals/generator';
import { createInstruments, createStrategyConfig, createUTCForIST } from './test-utils';
import type { CandleResampled } from '../src/types';

function makeBar(hourIST: number, minuteIST: number, close: number): CandleResampled {
  return {
    instrumentId: 1,
    timeframe: '15m',
    barTime: createUTCForIST(2024, 1, 15, hourIST, minuteIST),
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  };
}

describe('StreamingSignalGenerator regression tests', () => {
  test('S1-009: entry fires after a previous exit (no bracket deadlock)', () => {
    const gen = new StreamingSignalGenerator(createStrategyConfig(), createInstruments(), 'paper');
    // Seed with EMA9 < EMA21
    gen.initializeFromHistory(100, 105, null);

    // Bar 1 (09:30 open -> 09:45 close): jump to 24000 -> EMA9 crosses ABOVE EMA21 -> BUY entry
    const entry1 = gen.processBar(makeBar(9, 30, 24000), null);
    expect(entry1.length).toBe(1);
    expect(entry1[0]?.signalType).toBe('BUY');
    expect(entry1[0]?.optionSymbol).not.toBe('');

    // Bar 2 (14:45 open -> 15:00 close): 15:00 square-off -> exit
    const exit1 = gen.processBar(makeBar(14, 45, 24000), null);
    expect(exit1.length).toBe(1);
    expect(exit1[0]?.metadata?.isExit).toBe(true);
    expect(gen.getCurrentPosition()).toBeNull();

    // Re-seed bearish state and trigger another bullish crossover on next bar
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
    expect(entry.optionSymbol).toBeTruthy();

    // Trigger 15:00 square-off exit
    const exitSignals = gen.processBar(makeBar(14, 45, 24000), null);
    expect(exitSignals.length).toBe(1);
    const exit = exitSignals[0]!;
    expect(exit.metadata?.isExit).toBe(true);
    expect(exit.optionSymbol).toBe(entry.optionSymbol);
    expect(exit.selectedStrike).toBe(entry.selectedStrike);
    expect(exit.optionType).toBe(entry.optionType);
  });
});
