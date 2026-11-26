import { describe, expect, test } from 'bun:test';
import { LiveBarAggregator, type ClosedLiveBar } from '../src/services/live-bar-aggregator';
import { isExpiryRolloverWindow, isNSETradingDay } from '../src/services/nse-holidays';

describe('Sprint 15 LiveBarAggregator & NSE Holiday Guard', () => {
  test('aggregates ticks into 09:15 IST aligned 5m bars and emits on boundary rollover', () => {
    const agg = new LiveBarAggregator();
    const closed: ClosedLiveBar[] = [];
    agg.onBarClose((bar) => closed.push(bar));

    // 09:16 IST -> 09:15 bucket
    agg.ingestTick('NIFTY', 24100, new Date('2026-11-26T09:16:00+05:30'));
    agg.ingestTick('NIFTY', 24125, new Date('2026-11-26T09:18:30+05:30'));
    expect(closed).toHaveLength(0);

    // 09:20 IST -> closes 09:15 5m bar
    agg.ingestTick('NIFTY', 24110, new Date('2026-11-26T09:20:05+05:30'));
    const closed5m = closed.find((b) => b.timeframe === '5m');
    expect(closed5m).toBeDefined();
    expect(closed5m?.open).toBe(24100);
    expect(closed5m?.high).toBe(24125);
    expect(closed5m?.close).toBe(24125);
  });

  test('identifies NSE holidays, weekends, and Thursday 14:30 expiry rollover window', () => {
    expect(isNSETradingDay(new Date('2026-12-25T10:00:00+05:30'))).toBe(false); // Christmas
    expect(isNSETradingDay(new Date('2026-11-28T10:00:00+05:30'))).toBe(false); // Saturday
    expect(isNSETradingDay(new Date('2026-11-26T10:00:00+05:30'))).toBe(true);  // Thursday

    expect(isExpiryRolloverWindow(new Date('2026-11-26T14:29:00+05:30'))).toBe(false);
    expect(isExpiryRolloverWindow(new Date('2026-11-26T14:30:00+05:30'))).toBe(true);
  });
});
