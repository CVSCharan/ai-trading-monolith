import { describe, expect, test } from 'bun:test';
import { LiveBarAggregator } from '../src/services/live-bar-aggregator';
import { resolveAggregatorSymbol } from '../src/services/market-data';

describe('LiveBarAggregator & MarketData symbol routing (GAP-26)', () => {
  test('closes final 15:15-15:30 IST bar on flushExpiredBars at 15:30 IST', () => {
    const agg = new LiveBarAggregator();
    const closed: Array<{ symbol: string; timeframe: string; close: number }> = [];
    agg.onBarClose((bar) => closed.push({ symbol: bar.symbol, timeframe: bar.timeframe, close: bar.close }));

    // 15:20 IST -> 15:28 IST on a Wednesday: 5m (15:20-15:25) closes automatically
    agg.ingestTick('NIFTY', 24500, new Date('2026-03-18T09:50:00.000Z'));
    agg.ingestTick('NIFTY', 24520, new Date('2026-03-18T09:58:00.000Z'));
    expect(closed.length).toBe(1);

    // 15:30 IST (10:00 UTC): flushes 5m (15:25), 15m (15:15), and 30m (15:15)
    const flushed = agg.flushExpiredBars(new Date('2026-03-18T10:00:00.000Z'));
    expect(flushed.length).toBe(3);
    expect(closed.length).toBe(4);
    expect(flushed.every((b) => b.symbol === 'NIFTY' && b.close === 24520)).toBe(true);
  });

  test('resolveAggregatorSymbol does not misroute equities into NIFTY', () => {
    expect(resolveAggregatorSymbol('NSE_INDEX|Nifty 50')).toBe('NIFTY');
    expect(resolveAggregatorSymbol('NSE_INDEX|Nifty Bank')).toBe('BANKNIFTY');
    expect(resolveAggregatorSymbol('NSE_EQ|INE002A01018')).toBe('INE002A01018');
  });
});
