// ============================================
// Live Bar Aggregator (S15-001)
// Aggregates incoming ticks into 09:15 IST-aligned 5m/15m/30m bars
// ============================================

import { getISTDateString } from '@groww-trading/shared';
import type { Timeframe } from '@groww-trading/strategy-core';
import { getISTMinutesSinceMidnight } from './nse-holidays';

export interface ClosedLiveBar {
  symbol: string;
  timeframe: Timeframe;
  barTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ActiveBar {
  bucketStartMs: number;
  barTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TF_MINUTES: Record<'5m' | '15m' | '30m', number> = { '5m': 5, '15m': 15, '30m': 30 };

export class LiveBarAggregator {
  private active = new Map<string, ActiveBar>();
  private listeners = new Set<(bar: ClosedLiveBar) => void>();

  onBarClose(listener: (bar: ClosedLiveBar) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private getBucket(ts: Date, tfMinutes: number): { bucketStartMs: number; barTime: Date } | null {
    const mins = getISTMinutesSinceMidnight(ts);
    const marketOpenMins = 9 * 60 + 15;
    if (mins < marketOpenMins || mins >= 15 * 60 + 30) return null;

    const offsetMins = Math.floor((mins - marketOpenMins) / tfMinutes) * tfMinutes;
    const bucketMins = marketOpenMins + offsetMins;
    const hh = String(Math.floor(bucketMins / 60)).padStart(2, '0');
    const mm = String(bucketMins % 60).padStart(2, '0');
    const istDate = getISTDateString(ts);
    const barTime = new Date(`${istDate}T${hh}:${mm}:00+05:30`);
    return { bucketStartMs: barTime.getTime(), barTime };
  }

  ingestTick(symbol: string, ltp: number, timestamp: Date = new Date(), volumeDelta = 0): void {
    for (const tf of ['5m', '15m', '30m'] as const) {
      const bucket = this.getBucket(timestamp, TF_MINUTES[tf]);
      if (!bucket) continue;

      const key = `${symbol}:${tf}`;
      const existing = this.active.get(key);

      if (existing && existing.bucketStartMs !== bucket.bucketStartMs) {
        const closed: ClosedLiveBar = {
          symbol,
          timeframe: tf,
          barTime: existing.barTime,
          open: existing.open,
          high: existing.high,
          low: existing.low,
          close: existing.close,
          volume: existing.volume,
        };
        for (const listener of this.listeners) {
          listener(closed);
        }
        this.active.delete(key);
      }

      const current = this.active.get(key);
      if (!current) {
        this.active.set(key, {
          bucketStartMs: bucket.bucketStartMs,
          barTime: bucket.barTime,
          open: ltp,
          high: ltp,
          low: ltp,
          close: ltp,
          volume: volumeDelta,
        });
      } else {
        current.high = Math.max(current.high, ltp);
        current.low = Math.min(current.low, ltp);
        current.close = ltp;
        current.volume += volumeDelta;
      }
    }
  }
}
