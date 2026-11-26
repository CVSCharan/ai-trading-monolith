import { describe, expect, test } from 'bun:test';
import {
  findContainingBar,
  findGaps,
  getNextMinuteOpen,
  resampleAllTimeframes,
  resampleCandles,
} from '../src/indicators/resample';
import type { Candle1m } from '../src/types';

function make1m(isoTimes: string[]): Candle1m[] {
  return isoTimes.map((t, i) => ({
    instrumentId: 1,
    barTime: new Date(t),
    open: 24000 + i,
    high: 24010 + i,
    low: 23990 + i,
    close: 24005 + i,
    volume: 100,
  }));
}

describe('Resample helpers (S2-009)', () => {
  test('resampleAllTimeframes returns 5m, 15m, and 30m maps', () => {
    const candles = make1m([
      '2026-11-01T03:45:00.000Z',
      '2026-11-01T03:46:00.000Z',
      '2026-11-01T03:50:00.000Z',
      '2026-11-01T04:00:00.000Z',
    ]);
    const map = resampleAllTimeframes(candles);
    expect(map.get('5m')?.length).toBeGreaterThanOrEqual(2);
    expect(map.get('15m')?.length).toBeGreaterThanOrEqual(2);
    expect(map.get('30m')?.length).toBeGreaterThanOrEqual(1);
  });

  test('findContainingBar locates bar or returns null', () => {
    const candles = make1m(['2026-11-01T03:45:00.000Z', '2026-11-01T03:46:00.000Z']);
    const bars5m = resampleCandles(candles, '5m');
    expect(findContainingBar(bars5m, new Date('2026-11-01T03:47:30.000Z'))).not.toBeNull();
    expect(findContainingBar(bars5m, new Date('2026-11-01T04:30:00.000Z'))).toBeNull();
  });

  test('getNextMinuteOpen rounds up to next minute boundary', () => {
    const next = getNextMinuteOpen(new Date('2026-11-01T03:45:29.500Z'));
    expect(next.toISOString()).toBe('2026-11-01T03:46:00.000Z');
  });

  test('findGaps detects missing 1m bars and handles < 2 candles', () => {
    expect(findGaps([])).toEqual([]);
    const candles = make1m([
      '2026-11-01T03:45:00.000Z',
      '2026-11-01T03:46:00.000Z',
      '2026-11-01T03:50:00.000Z',
    ]);
    const gaps = findGaps(candles);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.missingCount).toBe(3);
  });
});
