import { describe, expect, it } from 'bun:test';
import pino from 'pino';
import type { Signal } from '@groww-trading/strategy-core';
import { LiveTradingEngine, type LiveRiskConfig } from '../src/services/live-trading';
import type { GrowwClient } from '../src/services/groww-client';

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

// Real production signal fixtures (BUY/SELL with metadata.isExit)
const REAL_ENTRY_SIGNAL: Signal = {
  strategyId: 'strat-1',
  runType: 'live',
  barTime: new Date('2026-11-26T04:15:00.000Z'), // 09:45 IST
  signalType: 'BUY',
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
  metadata: { isExit: false, executionMode: 'DEEP_ITM_BUY' },
};

const REAL_EXIT_SIGNAL: Signal = {
  strategyId: 'strat-1',
  runType: 'live',
  barTime: new Date('2026-11-26T05:30:00.000Z'), // 11:00 IST
  signalType: 'SELL',
  ema9: 24490,
  ema21: 24510,
  spotPrice: 24480,
  selectedStrike: 24200,
  optionType: 'CE',
  optionSymbol: 'NIFTY26DEC24200CE',
  expiryDate: new Date('2026-12-31T00:00:00.000Z'),
  entryWindowValid: true,
  isReversal: false,
  currentPosition: 'LONG',
  metadata: { isExit: true, executionMode: 'DEEP_ITM_BUY', exitReason: 'OPPOSITE_CROSSOVER' },
};

describe('LiveTradingEngine (S19-006, S19-007, S19-008)', () => {
  it('blocks live entry when ENABLE_LIVE_TRADING is not true', async () => {
    const prev = process.env['ENABLE_LIVE_TRADING'];
    process.env['ENABLE_LIVE_TRADING'] = 'false';

    const placed: PlacedOrder[] = [];
    const engine = new LiveTradingEngine(
      null,
      pino({ level: 'silent' }),
      createMockGrowwClient(placed)
    );

    const res = await engine.placeOrder(
      'user-1',
      REAL_ENTRY_SIGNAL,
      RISK,
      'idem-1',
      75,
      125.5,
      new Date('2026-11-26T04:15:00.000Z')
    );

    expect(res.executed).toBe(false);
    expect(res.reason).toContain('ENABLE_LIVE_TRADING');
    expect(placed.length).toBe(0);
    process.env['ENABLE_LIVE_TRADING'] = prev;
  });

  it('correctly maps real strategy BUY entry and SELL exit signals', async () => {
    const prev = process.env['ENABLE_LIVE_TRADING'];
    process.env['ENABLE_LIVE_TRADING'] = 'true';

    try {
      const placed: PlacedOrder[] = [];
      const engine = new LiveTradingEngine(
        null,
        pino({ level: 'silent' }),
        createMockGrowwClient(placed)
      );

      const morningIST = new Date('2026-11-26T04:15:00.000Z');

      // 1. BUY Entry
      const entryRes = await engine.placeOrder('user-1', REAL_ENTRY_SIGNAL, RISK, 'idem-buy', 75, 145.5, morningIST);
      expect(entryRes.executed).toBe(true);
      expect(placed.length).toBe(1);
      expect(placed[0].side).toBe('BUY');
      expect(placed[0].orderType).toBe('LIMIT');
      // Limit price must use option premium (145.50 * 1.01 = 146.96), not index spot (24,530)
      expect(placed[0].price).toBe(146.96);

      // Confirm fill for entry
      engine.handleOrderUpdate({
        orderId: entryRes.order!.orderId,
        filledQuantity: 75,
        avgFillPrice: 145.5,
        status: 'COMPLETE',
      });

      // 2. SELL Exit
      const exitRes = await engine.placeOrder('user-1', REAL_EXIT_SIGNAL, RISK, 'idem-sell', 75, 160.0, morningIST);
      expect(exitRes.executed).toBe(true);
      expect(placed.length).toBe(2);
      expect(placed[1].side).toBe('SELL');
      expect(placed[1].orderType).toBe('LIMIT');
      // Limit price must use option premium (160.0 * 0.99 = 158.40)
      expect(placed[1].price).toBe(158.4);
    } finally {
      process.env['ENABLE_LIVE_TRADING'] = prev;
    }
  });

  it('onBarClose requires real option premium and refuses to fall back to spot price', async () => {
    const prev = process.env['ENABLE_LIVE_TRADING'];
    process.env['ENABLE_LIVE_TRADING'] = 'true';

    try {
      const placed: PlacedOrder[] = [];
      const engine = new LiveTradingEngine(
        null,
        pino({ level: 'silent' }),
        createMockGrowwClient(placed)
      );

      const mockGenerator = {
        processBar: () => [REAL_ENTRY_SIGNAL],
      };

      const bar = {
        instrumentId: 1,
        timeframe: '5m',
        barTime: new Date('2026-11-26T04:15:00.000Z'),
        open: 24500,
        high: 24540,
        low: 24490,
        close: 24530,
        volume: 10000,
      };

      // Case A: No option quote available -> Must NOT place order with spot price
      await engine.onBarClose('user-1', mockGenerator, bar, [], RISK);
      expect(placed.length).toBe(0);

      // Case B: Option quote lookup provides real premium -> Places order with option price
      await engine.onBarClose('user-1', mockGenerator, bar, [], RISK, () => 135.0);
      expect(placed.length).toBe(1);
      expect(placed[0].price).toBe(136.35); // 135 * 1.01
    } finally {
      process.env['ENABLE_LIVE_TRADING'] = prev;
    }
  });

  it('squareOffAll sets CLOSING and only transitions to CLOSED upon broker fill confirmation', async () => {
    const prev = process.env['ENABLE_LIVE_TRADING'];
    process.env['ENABLE_LIVE_TRADING'] = 'true';

    try {
      const placed: PlacedOrder[] = [];
      const engine = new LiveTradingEngine(
        null,
        pino({ level: 'silent' }),
        createMockGrowwClient(placed)
      );

      const morningIST = new Date('2026-11-26T04:15:00.000Z');

      // 1. Enter and fill position
      const entry = await engine.placeOrder('user-1', REAL_ENTRY_SIGNAL, RISK, 'idem-pos', 75, 120.0, morningIST);
      engine.handleOrderUpdate({
        orderId: entry.order!.orderId,
        filledQuantity: 75,
        avgFillPrice: 120.0,
        status: 'COMPLETE',
      });
      expect(engine.getOpenPositions().length).toBe(1);

      // 2. Initiate square-off
      const requested = await engine.squareOffAll('15:00 IST square-off');
      expect(requested).toBe(1);
      expect(placed.length).toBe(2);
      expect(placed[1].side).toBe('SELL');

      // INVARIANT: Position is CLOSING, not CLOSED yet!
      const positionsWhileClosing = engine.getOpenPositions();
      expect(positionsWhileClosing.length).toBe(1);
      expect(positionsWhileClosing[0].status).toBe('CLOSING');

      // 3. Broker fill arrives -> Position transitions to CLOSED
      const closeOrderId = placed[1] as any; // orderId generated was ORD-2
      const updated = engine.handleOrderUpdate({
        orderId: 'ORD-2',
        filledQuantity: 75,
        avgFillPrice: 118.0,
        status: 'COMPLETE',
      });
      expect(updated?.status).toBe('CLOSED');
      expect(engine.getOpenPositions().length).toBe(0);
    } finally {
      process.env['ENABLE_LIVE_TRADING'] = prev;
    }
  });
});
