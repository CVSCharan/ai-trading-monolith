import { describe, expect, test } from 'bun:test';
import {
  detectCrossover,
  crossoverToSignal,
  shouldExitOnCrossover,
  shouldSquareOff,
  isReversal,
} from '../src/indicators/crossover';
import { createUTCForIST } from './test-utils';

describe('Crossover Detection (S2-001)', () => {
  test('detects BULLISH when EMA9 crosses above EMA21', () => {
    const ema9 = [100, 102, 106];
    const ema21 = [103, 103, 104];
    expect(detectCrossover(ema9, ema21)).toEqual(['NONE', 'NONE', 'BULLISH']);
  });

  test('detects BEARISH when EMA9 crosses below EMA21', () => {
    const ema9 = [106, 104, 101];
    const ema21 = [103, 103, 103];
    expect(detectCrossover(ema9, ema21)).toEqual(['NONE', 'NONE', 'BEARISH']);
  });

  test('returns NONE when no crossover occurs', () => {
    const ema9 = [105, 106, 107];
    const ema21 = [100, 101, 102];
    expect(detectCrossover(ema9, ema21)).toEqual(['NONE', 'NONE', 'NONE']);
  });

  test('returns NONE during NaN warmup period', () => {
    const ema9 = [NaN, NaN, 105];
    const ema21 = [NaN, 102, 103];
    expect(detectCrossover(ema9, ema21)).toEqual(['NONE', 'NONE', 'NONE']);
  });

  test('does not trigger false crossover on equal values', () => {
    const ema9 = [100, 100, 100];
    const ema21 = [100, 100, 100];
    expect(detectCrossover(ema9, ema21)).toEqual(['NONE', 'NONE', 'NONE']);
  });

  test('maps crossover direction and exit/reversal helpers accurately', () => {
    expect(crossoverToSignal('BULLISH')).toBe('BUY');
    expect(crossoverToSignal('BEARISH')).toBe('SELL');
    expect(crossoverToSignal('NONE')).toBeNull();

    expect(shouldExitOnCrossover('LONG', 'BEARISH')).toBe(true);
    expect(shouldExitOnCrossover('LONG', 'BULLISH')).toBe(false);
    expect(shouldExitOnCrossover('SHORT', 'BULLISH')).toBe(true);

    expect(isReversal('LONG', 'BEARISH')).toBe(true);
    expect(isReversal(null, 'BULLISH')).toBe(false);

    expect(shouldSquareOff(createUTCForIST(2024, 1, 15, 15, 0), '15:00')).toBe(true);
    expect(shouldSquareOff(createUTCForIST(2024, 1, 15, 14, 55), '15:00')).toBe(false);
  });
});
