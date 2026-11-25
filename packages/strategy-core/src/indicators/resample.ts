// ============================================
// Resampling: 1m → 5m/15m/30m aligned to 09:15 IST
// ============================================

import { Candle1m, CandleResampled, Timeframe } from '../types';
import {
  toIST,
  createISTDate,
  getMinutesIST,
  getMinutesISTFromUTC
} from '@groww-trading/shared';

export function timeframeToMinutes(tf: Timeframe): number {
  return { '1m': 1, '5m': 5, '15m': 15, '30m': 30 }[tf];
}

export function getAlignedBarTimeIST(timestamp: Date, timeframeMinutes: number): Date {
  const ist = toIST(timestamp);
  const totalMinutes = getMinutesIST(ist) - (9 * 60 + 15);

  if (totalMinutes < 0) {
    return createISTDate(ist.getFullYear(), ist.getMonth(), ist.getDate(), 9, 15);
  }

  const alignedIndex = Math.floor(totalMinutes / timeframeMinutes);
  const alignedMinutes = alignedIndex * timeframeMinutes;
  const hour = Math.floor((9 * 60 + 15 + alignedMinutes) / 60);
  const minute = (9 * 60 + 15 + alignedMinutes) % 60;

  return createISTDate(
    ist.getFullYear(),
    ist.getMonth(),
    ist.getDate(),
    hour,
    minute
  );
}

export function getBarCloseTimeIST(barOpen: Date, timeframeMinutes: number): Date {
  const close = new Date(barOpen);
  close.setMinutes(close.getMinutes() + timeframeMinutes);
  return close;
}

export function isMarketHoursBar(
  barOpen: Date,
  timeframeMinutes: number
): boolean {
  const openMinutes = getMinutesISTFromUTC(barOpen);
  const closeMinutes = openMinutes + timeframeMinutes;

  // Bar must start at or after market open (09:15)
  // and close at or before market close (15:30)
  return openMinutes >= 9 * 60 + 15 &&
         closeMinutes <= 15 * 60 + 30;
}

export function resampleCandles(
  candles: Candle1m[],
  timeframe: Timeframe
): CandleResampled[] {
  if (candles.length === 0) return [];

  const minutes = timeframeToMinutes(timeframe);
  const groups = new Map<number, Candle1m[]>();

  // Group 1m candles by aligned bar OPEN time
  for (const candle of candles) {
    const barOpen = getAlignedBarTimeIST(candle.barTime, minutes);
    const key = barOpen.getTime();

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(candle);
  }

  // Build resampled candles
  const result: CandleResampled[] = [];

  for (const [key, group] of groups) {
    if (group.length === 0) continue;

    // Sort group by time (should already be sorted)
    group.sort((a, b) => a.barTime.getTime() - b.barTime.getTime());

    const barOpen = new Date(key);

    // Verify bar is within market hours
    if (!isMarketHoursBar(barOpen, minutes)) {
      continue;
    }

    const open = group[0].open;
    const high = Math.max(...group.map(c => c.high));
    const low = Math.min(...group.map(c => c.low));
    const close = group[group.length - 1].close;
    const volume = group.reduce((sum, c) => sum + c.volume, 0);
    const oi = group[group.length - 1].oi;

    result.push({
      instrumentId: group[0].instrumentId,
      timeframe,
      barTime: barOpen,
      open,
      high,
      low,
      close,
      volume,
      oi
    });
  }

  // Sort by bar time
  result.sort((a, b) => a.barTime.getTime() - b.barTime.getTime());

  return result;
}

export function resampleAllTimeframes(
  candles: Candle1m[]
): Map<Timeframe, CandleResampled[]> {
  const result = new Map<Timeframe, CandleResampled[]>();

  for (const tf of ['5m', '15m', '30m'] as Timeframe[]) {
    result.set(tf, resampleCandles(candles, tf));
  }

  return result;
}

export function findContainingBar(
  resampled: CandleResampled[],
  timestamp: Date
): CandleResampled | null {
  const ts = timestamp.getTime();

  for (let i = 0; i < resampled.length; i++) {
    const barOpen = resampled[i].barTime.getTime();
    const barClose = barOpen + timeframeToMinutes(resampled[i].timeframe) * 60 * 1000;

    if (ts >= barOpen && ts < barClose) {
      return resampled[i];
    }
  }

  return null;
}

export function getNextMinuteOpen(timestamp: Date): Date {
  const next = new Date(timestamp);
  next.setMinutes(next.getMinutes() + 1, 0, 0);
  return next;
}

export function findGaps(
  candles: Candle1m[],
  expectedIntervalMs: number = 60 * 1000
): { start: Date; end: Date; missingCount: number }[] {
  if (candles.length < 2) return [];

  const gaps: { start: Date; end: Date; missingCount: number }[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].barTime.getTime();
    const curr = candles[i].barTime.getTime();
    const diff = curr - prev;

    if (diff > expectedIntervalMs * 1.5) {
      const missingCount = Math.round(diff / expectedIntervalMs) - 1;
      gaps.push({
        start: new Date(prev + expectedIntervalMs),
        end: new Date(curr - expectedIntervalMs),
        missingCount
      });
    }
  }

  return gaps;
}