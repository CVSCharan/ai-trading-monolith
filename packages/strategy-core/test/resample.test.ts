// ============================================
// Resample Tests
// ============================================

import { describe, it, expect } from 'bun:test';
import { timeframeToMinutes, resampleCandles } from '../src/indicators/resample';
import { Candle1m } from '../src/types';

// Helper: create UTC date for a given IST time
// 09:15 IST = 03:45 UTC (IST = UTC + 5:30)
function createUTCForIST(year: number, month: number, day: number, hourIST: number, minuteIST: number): Date {
  const utcHour = hourIST - 5;
  const utcMin = minuteIST - 30;
  let finalHour = utcHour;
  let finalMin = utcMin;
  if (finalMin < 0) {
    finalMin += 60;
    finalHour -= 1;
  }
  if (finalHour < 0) {
    finalHour += 24;
  }
  return new Date(Date.UTC(year, month - 1, day, finalHour, finalMin));
}

const create1mCandle = (instrumentId: number, barTime: Date, open: number, high: number, low: number, close: number, volume: number): Candle1m => ({
  instrumentId,
  barTime,
  open, high, low, close, volume, oi: undefined
});

describe('Resampling', () => {
  describe('timeframeToMinutes', () => {
    it('maps 5m to 5', () => {
      expect(timeframeToMinutes('5m')).toBe(5);
    });

    it('maps 15m to 15', () => {
      expect(timeframeToMinutes('15m')).toBe(15);
    });

    it('maps 30m to 30', () => {
      expect(timeframeToMinutes('30m')).toBe(30);
    });
  });

  describe('resampleCandles: 5m boundaries at 09:15 IST', () => {
    it('resamples first 5m bar from 09:15-09:20 with 5 candles', () => {
      const candles: Candle1m[] = [
        create1mCandle(1, createUTCForIST(2024, 1, 1, 9, 15), 24000, 24010, 23990, 24005, 100),
        create1mCandle(1, createUTCForIST(2024, 1, 1, 9, 16), 24005, 24015, 24000, 24012, 120),
        create1mCandle(1, createUTCForIST(2024, 1, 1, 9, 17), 24010, 24020, 24010, 24018, 130),
        create1mCandle(1, createUTCForIST(2024, 1, 1, 9, 18), 24015, 24025, 24012, 24022, 140),
        create1mCandle(1, createUTCForIST(2024, 1, 1, 9, 19), 24020, 24030, 24020, 24028, 150),
      ];

      const result = resampleCandles(candles, '5m');
      // 5 candles in 09:15-09:20 window = 1 resampled bar
      expect(result.length).toBe(1);
      expect(result[0].open).toBe(24000);
      expect(result[0].high).toBe(24030); // max of all 5
      expect(result[0].low).toBe(23990);
      expect(result[0].close).toBe(24028); // close of 5th candle
    });

    it('resamples 5 consecutive 5m bars (25 candles)', () => {
      const candles: Candle1m[] = [];
      // 25 candles = 5 five-minute bars (09:15-09:40)
      for (let i = 0; i < 25; i++) {
        const min = 15 + i;
        const hour = 9 + Math.floor(min / 60);
        const minute = min % 60;
        candles.push(create1mCandle(1, createUTCForIST(2024, 1, 1, hour, minute),
          24000 + i, 24010 + i, 23990 + i, 24005 + i, 100 + i));
      }

      const result = resampleCandles(candles, '5m');
      expect(result.length).toBe(5);
      // First bar (5 candles: indices 0-4): open=24000, close=24005+4=24009
      expect(result[0].open).toBe(24000);
      expect(result[0].close).toBe(24009);
      // Second bar (indices 5-9): open=24005, close=24014
      expect(result[1].open).toBe(24005);
      expect(result[1].close).toBe(24014);
    });
  });

  describe('resampleCandles: 15m boundaries at 09:15 IST', () => {
    it('resamples first 15m bar from 09:15-09:30', () => {
      const candles: Candle1m[] = [];
      // 15 candles = 1 fifteen-minute bar (09:15-09:30)
      for (let i = 0; i < 15; i++) {
        const min = 15 + i;
        const hour = 9 + Math.floor(min / 60);
        const minute = min % 60;
        candles.push(create1mCandle(1, createUTCForIST(2024, 1, 1, hour, minute),
          24000 + i, 24010 + i, 23990 + i, 24005 + i, 100 + i));
      }

      const result = resampleCandles(candles, '15m');
      expect(result.length).toBe(1);
      expect(result[0].open).toBe(24000);
      expect(result[0].high).toBe(24024); // 24010 + 14
      expect(result[0].low).toBe(23990);
      expect(result[0].close).toBe(24019); // 24005 + 14
    });

    it('resamples 3 fifteen-minute bars (45 candles)', () => {
      const candles: Candle1m[] = [];
      for (let i = 0; i < 45; i++) {
        const min = 15 + i;
        const hour = 9 + Math.floor(min / 60);
        const minute = min % 60;
        candles.push(create1mCandle(1, createUTCForIST(2024, 1, 1, hour, minute),
          24000 + i, 24010 + i, 23990 + i, 24005 + i, 100 + i));
      }

      const result = resampleCandles(candles, '15m');
      expect(result.length).toBe(3);
      // First 15m bar: indices 0-14
      expect(result[0].open).toBe(24000);
      expect(result[0].close).toBe(24019);
      // Second 15m bar: indices 15-29
      expect(result[1].open).toBe(24015);
      expect(result[1].close).toBe(24034);
    });
  });

  describe('resampleCandles: 30m short bar at 15:15-15:30', () => {
    it('30m bar starting at 15:15 has only 15 minutes (closes at 15:30)', () => {
      const candles: Candle1m[] = [
        create1mCandle(1, createUTCForIST(2024, 1, 1, 15, 10), 24000, 24010, 23990, 24005, 100),
        create1mCandle(1, createUTCForIST(2024, 1, 1, 15, 15), 24010, 24020, 24010, 24018, 130),
        create1mCandle(1, createUTCForIST(2024, 1, 1, 15, 20), 24015, 24025, 24012, 24022, 140),
        create1mCandle(1, createUTCForIST(2024, 1, 1, 15, 25), 24020, 24030, 24020, 24028, 150),
        create1mCandle(1, createUTCForIST(2024, 1, 1, 15, 30), 24025, 24035, 24022, 24032, 160),
      ];

      const result = resampleCandles(candles, '30m');
      // 30m bar starting at 15:15 would close at 15:45, past 15:30 market close
      // The 15:15 bar should be dropped; 15:00-15:30 should be the last valid
      // But we only have 15:10-15:30 candles, so only the 15:00-15:30 bar should form
      expect(result.length).toBe(1);
    });
  });

  describe('resampleCandles: multi-day input', () => {
    it('handles multiple days of 1m data', () => {
      const candles: Candle1m[] = [
        // Day 1: 09:15-09:20
        create1mCandle(1, createUTCForIST(2024, 1, 1, 9, 15), 24000, 24010, 23990, 24005, 100),
        create1mCandle(1, createUTCForIST(2024, 1, 1, 9, 16), 24005, 24015, 24000, 24012, 120),
        // Day 2: 09:15-09:20
        create1mCandle(1, createUTCForIST(2024, 1, 2, 9, 15), 24010, 24020, 24000, 24015, 130),
        create1mCandle(1, createUTCForIST(2024, 1, 2, 9, 16), 24015, 24025, 24010, 24022, 140),
      ];

      const result = resampleCandles(candles, '5m');
      // Should produce 1 bar for each day = 2 bars total
      expect(result.length).toBe(2);
    });
  });

  describe('resampleCandles: missing 1m bars (gaps)', () => {
    it('handles sparse 1m input gracefully', () => {
      // Only 3 candles for a 5m bar that needs 5
      const candles: Candle1m[] = [
        create1mCandle(1, createUTCForIST(2024, 1, 1, 9, 15), 24000, 24010, 23990, 24005, 100),
        create1mCandle(1, createUTCForIST(2024, 1, 1, 9, 17), 24015, 24025, 24010, 24020, 130),
        create1mCandle(1, createUTCForIST(2024, 1, 1, 9, 19), 24020, 24030, 24020, 24028, 150),
      ];

      const result = resampleCandles(candles, '5m');
      // May produce partial results or empty - depends on implementation
      // The key: no crash, handles gracefully
      expect(Array.isArray(result)).toBe(true);
    });
  });
});