import { describe, expect, it } from 'bun:test';
import pino from 'pino';
import type { Signal } from '@groww-trading/strategy-core';
import { LiveTradingEngine, type LiveRiskConfig } from '../src/services/live-trading';
import type { GrowwClient } from '../src/services/groww-client';
import type { MarketDataService } from '../src/services/market-data';

type PlacedOrder = {
  symbol: string;
  exchange: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  price?: number;
  product: 'CNC' | 'MIS' | 'NRML';
  validity: 'DAY' | 'IOC';
};

function createMockGrowwClient(ordersOut: PlacedOrder[]): GrowwClient {
  let seq = 1;
  return {
    async placeOrder(req: PlacedOrder) {
      ordersOut.push(req);
      return {
        orderId: `ORD-${seq++}`,
        status: 'OPEN',
        filledQuantity: 0,
        avgPrice: req.price ?? 120,
      };
    },
  } as unknown as GrowwClient;
}

const RISK: LiveRiskConfig = {
  capital: 100000,
  maxDailyLossPct: 1.5,
  maxOpenPositions: 1,
  maxLotsPerOrder: 2,
  lotSize: 75,
};

const ENTRY_SIGNAL: Signal = {
  strategyId: 'strat-1',
  runType: 'LIVE',
  barTime: new Date('2026-11-26T04:15:00.000Z'), // 09:45 IST
  signalType: 'ENTRY_LONG',
  ema9: 24520,
  ema21: 24505,
  spotPrice: 24530,
  selectedStrike: 24200,
  optionType: 'CE',
  optionSymbol: 'NIFTY26DEC24200CE',
  expiryDate: new Date('2026-12-31T00:00:00.000Z'),
  entryWindowValid: true,
  isReversal: false,
  currentPosition: null,
};

describe('LiveTradingEngine (S6-002..S6-005)', () => {
  it('blocks live entry when ENABLE_LIVE_TRADING is not true', async () => {
    const prev = process.env['ENABLE_LIVE_TRADING'];
    process.env['ENABLE_LIVE_TRADING'] = 'false';

    const placed: PlacedOrder[] = [];
    const engine = new LiveTradingEngine(
      null,
      pino({ level: 'silent' }),
      createMockGrowwClient(placed),
      {} as MarketDataService
    );

    const res = await engine.placeOrder(
      'user-1',
      ENTRY_SIGNAL,
      RISK,
      'idem-1',
      75,
      125.5,
      new Date('2026-11-26T04:15:00.000Z')
    );

    expect(res.executed).toBe(false);
    expect(placed.length).toBe(0);
    process.env['ENABLE_LIVE_TRADING'] = prev;
  });

  it('enforces idempotency, tracks partial fills, and squares off unconditionally at 15:00 IST', async () => {
    const prev = process.env['ENABLE_LIVE_TRADING'];
    process.env['ENABLE_LIVE_TRADING'] = 'true';

    try {
      const placed: PlacedOrder[] = [];
      const engine = new LiveTradingEngine(
        null,
        pino({ level: 'silent' }),
        createMockGrowwClient(placed),
        {} as MarketDataService
      );

      const morningIST = new Date('2026-11-26T04:15:00.000Z'); // 09:45 IST

      // 1. Place order
      const first = await engine.placeOrder('user-1', ENTRY_SIGNAL, RISK, 'idem-abc', 75, 125.5, morningIST);
      expect(first.executed).toBe(true);
      expect(placed.length).toBe(1);

      // 2. Duplicate idempotency key does NOT place a second order
      const dup = await engine.placeOrder('user-1', ENTRY_SIGNAL, RISK, 'idem-abc', 75, 125.5, morningIST);
      expect(dup.executed).toBe(false);
      expect(dup.reason).toContain('Duplicate');
      expect(placed.length).toBe(1);

      // 3. Partial fill then full fill tracking
      const partial = engine.handleOrderUpdate({
        orderId: first.order!.orderId,
        filledQuantity: 50,
        avgFillPrice: 126.2,
        status: 'PARTIAL',
      });
      expect(partial?.status).toBe('PARTIAL');
      expect(partial?.filledQuantity).toBe(50);

      const full = engine.handleOrderUpdate({
        orderId: first.order!.orderId,
        filledQuantity: 75,
        avgFillPrice: 126.0,
        status: 'COMPLETE',
      });
      expect(full?.status).toBe('OPEN');
      expect(full?.avgEntryPrice).toBe(126.0);

      // 4. Unconditional 15:00 IST square-off closes position with marketable LIMIT SELL (NSE Algo compliant)
      const closed = await engine.squareOffAll('15:00 IST square-off');
      expect(closed).toBe(1);
      expect(placed.length).toBe(2);
      expect(placed[1].side).toBe('SELL');
      expect(placed[1].orderType).toBe('LIMIT');
      expect(placed[1].price).toBeGreaterThan(0);
      expect(engine.getOpenPositions().length).toBe(0);
    } finally {
      process.env['ENABLE_LIVE_TRADING'] = prev;
    }
  });
});
