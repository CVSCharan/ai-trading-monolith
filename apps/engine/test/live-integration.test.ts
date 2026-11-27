import { describe, expect, it } from 'bun:test';
import pino from 'pino';
import { StreamingSignalGenerator, type Signal } from '@groww-trading/strategy-core';
import { LiveTradingEngine, type LiveRiskConfig } from '../src/services/live-trading';
import { BrokerOrderSyncService } from '../src/services/broker-order-sync';
import type { BrokerRouter } from '../src/services/broker-router';
import type { WebSocketManager } from '../src/services/websocket-manager';

describe('Live Trading End-to-End Simulation (S19-011)', () => {
  it('full lifecycle: bar close -> signal -> quote -> order -> fill -> reversal -> 15:00 square-off', async () => {
    const prev = process.env['ENABLE_LIVE_TRADING'];
    process.env['ENABLE_LIVE_TRADING'] = 'true';

    try {
      // 1. Setup mock broker that records all placed orders
      const placedOrders: Array<{
        symbol: string;
        side: 'BUY' | 'SELL';
        orderType: string;
        price: number;
        quantity: number;
        orderId: string;
      }> = [];
      let orderSeq = 1;

      const mockGroww = {
        async placeOrder(req: any) {
          const orderId = `ORD-SIM-${orderSeq++}`;
          placedOrders.push({
            symbol: req.symbol,
            side: req.side,
            orderType: req.orderType,
            price: req.price,
            quantity: req.quantity,
            orderId,
          });
          return {
            orderId,
            status: 'OPEN',
            filledQuantity: 0,
            avgPrice: req.price,
          };
        },
      } as any;

      // 2. Setup WebSocket manager to capture broadcasts
      const wsEvents: Array<{ channel: string; data: any }> = [];
      const mockWsManager = {
        broadcast(channel: string, data: any) {
          wsEvents.push({ channel, data });
        },
      } as unknown as WebSocketManager;

      // 3. Setup mock broker router
      const mockBrokerRouter = {
        executionBroker: mockGroww,
        dataBroker: {
          async getQuote(symbols: string[]) {
            const out: Record<string, any> = {};
            for (const s of symbols) {
              out[s] = { symbol: s, ltp: s.includes('CE') ? 140.0 : 120.0 };
            }
            return out;
          },
        } as any,
        activeExecutionBrokerName: 'groww',
        activeDataBrokerName: 'groww',
      } as BrokerRouter;

      // 4. Initialize Live Trading Engine & Order Sync Service
      const liveEngine = new LiveTradingEngine(
        null, // in-memory test mode
        pino({ level: 'silent' }),
        mockGroww,
      );

      const syncService = new BrokerOrderSyncService(
        liveEngine,
        mockBrokerRouter,
        mockWsManager,
        pino({ level: 'silent' }),
      );

      const RISK: LiveRiskConfig = {
        capital: 500000,
        maxDailyLossPct: 2.0,
        maxOpenPositions: 2,
        maxLotsPerOrder: 2,
        lotSize: 75,
      };

      const quoteResolver = async (sig: Signal) => {
        return sig.optionType === 'CE' ? 140.0 : 120.0;
      };

      // 5. Step 1: Simulate bullish 9/21 EMA crossover entry at 09:45 IST
      const entrySignal: Signal = {
        strategyId: 'strat-e2e',
        runType: 'live',
        barTime: new Date('2026-11-26T04:15:00.000Z'), // 09:45 IST
        signalType: 'BUY',
        ema9: 24520,
        ema21: 24500,
        spotPrice: 24530,
        selectedStrike: 24200,
        optionType: 'CE',
        optionSymbol: 'NIFTY26DEC24200CE',
        expiryDate: new Date('2026-12-31T00:00:00.000Z'),
        entryWindowValid: true,
        isReversal: false,
        currentPosition: null,
        metadata: { isExit: false, executionMode: 'DEEP_ITM_BUY', canTrade: true },
      };

      const mockGenerator = {
        processBar: () => [entrySignal],
      };

      const closedBar1 = {
        instrumentId: 1,
        timeframe: '5m',
        barTime: new Date('2026-11-26T04:15:00.000Z'),
        open: 24500,
        high: 24540,
        low: 24490,
        close: 24530,
        volume: 25000,
      };

      await liveEngine.onBarClose('user-e2e', mockGenerator, closedBar1, [], RISK, quoteResolver);

      // Verify order 1 placed
      expect(placedOrders.length).toBe(1);
      expect(placedOrders[0].symbol).toBe('NIFTY26DEC24200CE');
      expect(placedOrders[0].side).toBe('BUY');
      expect(placedOrders[0].orderType).toBe('LIMIT');
      expect(placedOrders[0].price).toBe(141.4); // 140 * 1.01

      // Position should be PENDING
      expect(liveEngine.getOpenPositions().length).toBe(1);
      expect(liveEngine.getOpenPositions()[0].status).toBe('PENDING');

      // 6. Step 2: Broker Execution Fill arrives via WebSocket fill ingestion
      syncService.ingestFillUpdate({
        orderId: placedOrders[0].orderId,
        filledQuantity: 75,
        avgFillPrice: 140.5,
        status: 'COMPLETE',
      });

      // Position transitions to OPEN
      const openPos = liveEngine.getOpenPositions()[0];
      expect(openPos.status).toBe('OPEN');
      expect(openPos.avgEntryPrice).toBe(140.5);

      // 7. Step 3: Death crossover occurs at 10:30 IST -> Reversal Signal (LONG -> SHORT)
      const reversalSignal: Signal = {
        strategyId: 'strat-e2e',
        runType: 'live',
        barTime: new Date('2026-11-26T05:00:00.000Z'), // 10:30 IST
        signalType: 'SELL',
        ema9: 24470,
        ema21: 24495,
        spotPrice: 24460,
        selectedStrike: 24500,
        optionType: 'PE',
        optionSymbol: 'NIFTY26DEC24500PE',
        expiryDate: new Date('2026-12-31T00:00:00.000Z'),
        entryWindowValid: true,
        isReversal: true,
        currentPosition: 'LONG',
        metadata: {
          reversedFrom: 'LONG',
          executionMode: 'DEEP_ITM_BUY',
          canTrade: true,
        },
      };

      const mockReversalGenerator = {
        processBar: () => [reversalSignal],
      };

      const closedBar2 = {
        instrumentId: 1,
        timeframe: '5m',
        barTime: new Date('2026-11-26T05:00:00.000Z'),
        open: 24490,
        high: 24495,
        low: 24450,
        close: 24460,
        volume: 30000,
      };

      await liveEngine.onBarClose('user-e2e', mockReversalGenerator, closedBar2, [], RISK, quoteResolver);

      // Sequential reversal must have placed 2 new orders:
      // Order 2: SELL to close CE position
      // Order 3: BUY to enter PE position
      expect(placedOrders.length).toBe(3);
      expect(placedOrders[1].symbol).toBe('NIFTY26DEC24200CE');
      expect(placedOrders[1].side).toBe('SELL');
      expect(placedOrders[2].symbol).toBe('NIFTY26DEC24500PE');
      expect(placedOrders[2].side).toBe('BUY');
      expect(placedOrders[2].price).toBe(121.2); // 120 * 1.01

      // 8. Confirm fills for both reversal orders
      // Close fill for CE (sold at 145.0, profit = (145.0 - 140.5) * 75 = +337.50)
      syncService.ingestFillUpdate({
        orderId: placedOrders[1].orderId,
        filledQuantity: 75,
        avgFillPrice: 145.0,
        status: 'COMPLETE',
      });

      // Entry fill for PE (bought at 120.0)
      syncService.ingestFillUpdate({
        orderId: placedOrders[2].orderId,
        filledQuantity: 75,
        avgFillPrice: 120.0,
        status: 'COMPLETE',
      });

      // Now only 1 position remains open (the PE position)
      const currentPositions = liveEngine.getOpenPositions();
      expect(currentPositions.length).toBe(1);
      expect(currentPositions[0].optionSymbol).toBe('NIFTY26DEC24500PE');
      expect(currentPositions[0].status).toBe('OPEN');

      // 9. Step 4: 15:00 IST Square-off triggered
      const sqOffCount = await liveEngine.squareOffAll('15:00 IST square-off');
      expect(sqOffCount).toBe(1);

      // Order 4 placed: SELL to close remaining PE position
      expect(placedOrders.length).toBe(4);
      expect(placedOrders[3].symbol).toBe('NIFTY26DEC24500PE');
      expect(placedOrders[3].side).toBe('SELL');

      // Position is currently CLOSING
      expect(liveEngine.getOpenPositions()[0].status).toBe('CLOSING');

      // 10. Step 5: Broker fill update arrives for square-off order
      syncService.ingestFillUpdate({
        orderId: placedOrders[3].orderId,
        filledQuantity: 75,
        avgFillPrice: 125.0,
        status: 'COMPLETE',
      });

      // Portfolio must now be completely flat (0 open positions)
      expect(liveEngine.getOpenPositions().length).toBe(0);
    } finally {
      process.env['ENABLE_LIVE_TRADING'] = prev;
    }
  });
});
