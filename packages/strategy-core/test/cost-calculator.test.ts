import { describe, expect, test } from 'bun:test';
import {
  calculateLegCosts,
  calculateTradePnL,
  DEFAULT_COST_CONFIG,
  getCostConfigForDate,
  HISTORICAL_COST_CONFIGS,
} from '../src/execution/cost-calculator';

describe('Cost Calculator (S2-009)', () => {
  test('calculateLegCosts applies STT only on SELL and stamp duty only on BUY', () => {
    const buy = calculateLegCosts(DEFAULT_COST_CONFIG, 200, 75, 'BUY', 199.5, 200.5);
    expect(buy.stt).toBe(0);
    expect(buy.stamp).toBeGreaterThan(0);
    expect(buy.slippage).toBeCloseTo(37.5, 4); // (200.5 - 199.5) * 0.5 * 75

    const sell = calculateLegCosts(DEFAULT_COST_CONFIG, 200, 75, 'SELL', 199.5, 200.5);
    expect(sell.stt).toBeCloseTo(200 * 75 * 0.001, 4);
    expect(sell.stamp).toBe(0);
  });

  test('calculateTradePnL computes gross, costs, and net for LONG and SHORT', () => {
    const longPnl = calculateTradePnL(DEFAULT_COST_CONFIG, 100, 140, 75, 'LONG');
    expect(longPnl.grossPnl).toBe(3000);
    expect(longPnl.netPnl).toBeCloseTo(3000 - longPnl.totalCosts, 4);

    const shortPnl = calculateTradePnL(DEFAULT_COST_CONFIG, 140, 100, 75, 'SHORT');
    expect(shortPnl.grossPnl).toBe(3000);
    expect(shortPnl.netPnl).toBeCloseTo(3000 - shortPnl.totalCosts, 4);
  });

  test('getCostConfigForDate selects 2023 vs 2024+ dated config and falls back safely', () => {
    const cfg2023 = getCostConfigForDate(new Date('2023-06-15'), HISTORICAL_COST_CONFIGS);
    expect(cfg2023.sttPct).toBe(0.0005);

    const cfg2024 = getCostConfigForDate(new Date('2024-06-15'), HISTORICAL_COST_CONFIGS);
    expect(cfg2024.sttPct).toBe(0.001);

    const fallback = getCostConfigForDate(new Date('2020-01-01'), []);
    expect(fallback.sttPct).toBe(DEFAULT_COST_CONFIG.sttPct);
  });
});
