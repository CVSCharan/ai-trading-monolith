// ============================================
// EMA Tests
// ============================================

import { describe, it, expect } from 'bun:test';
import {
  calculateEMA,
  calculateEMA9and21,
  initializeEMAs,
  updateEMA,
  StreamingEMA,
} from '../src/indicators/ema';

describe('EMA Calculation', () => {
  describe('calculateEMA', () => {
    it('returns NaN for insufficient data', () => {
      const result = calculateEMA([100, 101, 102], 5);
      expect(result.every(isNaN)).toBe(true);
    });

    it('seeds with SMA of first N values', () => {
      const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
      const ema9 = calculateEMA(prices, 9);

      // First 8 values should be NaN
      expect(ema9.slice(0, 8).every(isNaN)).toBe(true);

      // 9th value (index 8) should be SMA of first 9
      const sma9 = prices.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
      expect(ema9[8]).toBeCloseTo(sma9, 5);
    });

    it('calculates EMA correctly after seed', () => {
      const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112];
      const ema9 = calculateEMA(prices, 9);

      // Verify recursive formula
      const mult = 2 / 10;
      for (let i = 9; i < prices.length; i++) {
        const expected = (prices[i] - ema9[i - 1]) * mult + ema9[i - 1];
        expect(ema9[i]).toBeCloseTo(expected, 10);
      }
    });

    it('handles constant prices', () => {
      const prices = new Array(30).fill(100);  // 30 prices - enough for warmup
      const ema9 = calculateEMA(prices, 9);
      const ema21 = calculateEMA(prices, 21);

      // After warmup, EMA should equal the constant price
      // Index 8 is first valid EMA9, index 20 is first valid EMA21
      expect(ema9[8]).toBeCloseTo(100, 5);
      expect(ema21[20]).toBeCloseTo(100, 5);
    });
  });

  describe('calculateEMA9and21', () => {
    it('calculates both EMAs in one pass', () => {
      const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121];
      const { ema9, ema21 } = calculateEMA9and21(prices);

      expect(ema9.length).toBe(prices.length);
      expect(ema21.length).toBe(prices.length);

      // EMA9 warms up at index 8, EMA21 at index 20
      expect(isNaN(ema9[7])).toBe(true);
      expect(isNaN(ema9[8])).toBe(false);
      expect(isNaN(ema21[19])).toBe(true);
      expect(isNaN(ema21[20])).toBe(false);
    });
  });

  describe('initializeEMAs', () => {
    it('returns warmup status correctly', () => {
      // Less than 21 prices - not warmed up
      const result1 = initializeEMAs([100, 101, 102]);
      expect(result1.warmupComplete).toBe(false);
      expect(isNaN(result1.ema21)).toBe(true);

      // Exactly 21 prices - just warmed up
      const prices21 = new Array(21).fill(100).map((v, i) => v + i * 0.1);
      const result2 = initializeEMAs(prices21);
      expect(result2.warmupComplete).toBe(true);
      expect(isNaN(result2.ema21)).toBe(false);
    });
  });

  describe('updateEMA', () => {
    it('updates EMA incrementally', () => {
      let ema = 100;
      ema = updateEMA(ema, 101, 9);
      expect(ema).toBeCloseTo(100.2, 5);

      ema = updateEMA(ema, 102, 9);
      expect(ema).toBeCloseTo(100.56, 5);
    });
  });

  describe('StreamingEMA', () => {
    it('seeds correctly from buffer', () => {
      const streaming = new StreamingEMA();

      // Add 20 prices - not enough for EMA21
      for (let i = 0; i < 20; i++) {
        const result = streaming.addClose(100 + i * 0.1);
        expect(result.warmupComplete).toBe(false);
      }

      // 21st price - should be warmed up
      const result = streaming.addClose(102);
      expect(result.warmupComplete).toBe(true);
      expect(isNaN(result.ema21)).toBe(false);
    });

    it('maintains state across adds', () => {
      const streaming = new StreamingEMA();
      const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121];

      for (const price of prices) {
        streaming.addClose(price);
      }

      const state = streaming.getState();
      expect(state.warmupComplete).toBe(true);
      expect(isNaN(state.ema9)).toBe(false);
      expect(isNaN(state.ema21)).toBe(false);
    });

    it('resets correctly', () => {
      const streaming = new StreamingEMA();
      streaming.addClose(100);
      streaming.addClose(101);
      streaming.reset();

      const state = streaming.getState();
      expect(state.warmupComplete).toBe(false);
      expect(isNaN(state.ema9)).toBe(true);
    });
  });
});