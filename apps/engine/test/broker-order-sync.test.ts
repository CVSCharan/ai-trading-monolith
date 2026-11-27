import { describe, expect, it } from 'bun:test';
import pino from 'pino';
import type { Signal } from '@groww-trading/strategy-core';
import { LiveTradingEngine, type LiveRiskConfig } from '../src/services/live-trading';
import { BrokerOrderSyncService } from '../src/services/broker-order-sync';
import type { BrokerRouter } from '../src/services/broker-router';
import type { WebSocketManager } from '../src/services/websocket-manager';

const RISK: LiveRiskConfig = {
  capital: 100000,
  maxDailyLossPct: 1.5,
  maxOpenPositions: 2,
  maxLotsPerOrder: 2,
  lotSize: 75,
};

const DUMMY_SIGNAL: Signal = {
  strategyId: 'strat-1',
  runType: 'live',
  barTime: new Date('2026-11-26T04:15:00.000Z'),
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

describe('BrokerOrderSyncService (S19-008)', () => {
  it('direct ingestion updates position and broadcasts over WebSockets', async () => {
    const prev = process.env['ENABLE_LIVE_TRADING'];
    process.env['ENABLE_LIVE_TRADING'] = 'true';

    try {
      const mockGroww = {
        async placeOrder() {
          return { orderId: 'ORD-101', status: 'OPEN' };
        },
      } as any;

      const engine = new LiveTradingEngine(null, pino({ level: 'silent' }), mockGroww);
      const broadcastEvents: Array<{ channel: string; data: any }> = [];
      const mockWsManager = {
        broadcast(channel: string, data: any) {
          broadcastEvents.push({ channel, data });
        },
      } as unknown as WebSocketManager;

      const mockRouter = {
        executionBroker: {} as any,
        dataBroker: {} as any,
        activeExecutionBrokerName: 'groww',
        activeDataBrokerName: 'groww',
      } as BrokerRouter;

      const syncService = new BrokerOrderSyncService(
        engine,
        mockRouter,
        mockWsManager,
        pino({ level: 'silent' }),
      );

      // 1. Place initial pending order
      const res = await engine.placeOrder(
        'user-1',
        DUMMY_SIGNAL,
        RISK,
        'idem-sync-1',
        75,
        130.0,
        new Date('2026-11-26T04:15:00.000Z'),
      );
      expect(res.executed).toBe(true);

      const openPositions = engine.getOpenPositions();
      expect(openPositions.length).toBe(1);
      expect(openPositions[0].status).toBe('PENDING');

      // 2. Ingest broker fill update via syncService
      syncService.ingestFillUpdate({
        orderId: 'ORD-101',
        filledQuantity: 75,
        avgFillPrice: 130.0,
        status: 'COMPLETE',
      });

      // Position must now be OPEN
      expect(openPositions[0].status).toBe('OPEN');
      expect(openPositions[0].filledQuantity).toBe(75);

      // Verify WebSocket broadcasts
      expect(broadcastEvents.length).toBe(2);
      expect(broadcastEvents[0].channel).toBe('orders');
      expect(broadcastEvents[0].data.type).toBe('ORDER_FILL_UPDATE');
      expect(broadcastEvents[1].channel).toBe('positions');
      expect(broadcastEvents[1].data.type).toBe('POSITION_UPDATE');
    } finally {
      process.env['ENABLE_LIVE_TRADING'] = prev;
    }
  });

  it('syncOrderFills polls broker order book and synchronizes pending fills', async () => {
    const prev = process.env['ENABLE_LIVE_TRADING'];
    process.env['ENABLE_LIVE_TRADING'] = 'true';

    try {
      const mockGroww = {
        async placeOrder() {
          return { orderId: 'ORD-999', status: 'OPEN' };
        },
      } as any;

      const engine = new LiveTradingEngine(null, pino({ level: 'silent' }), mockGroww);
      const broadcastEvents: Array<{ channel: string; data: any }> = [];
      const mockWsManager = {
        broadcast(channel: string, data: any) {
          broadcastEvents.push({ channel, data });
        },
      } as unknown as WebSocketManager;

      // Mock broker that returns ORD-999 as COMPLETE
      const mockBroker = {
        async getOrderBook() {
          return [
            {
              orderId: 'ORD-999',
              symbol: 'NIFTY26DEC24200CE',
              side: 'BUY',
              status: 'COMPLETE',
              quantity: 75,
              filledQuantity: 75,
              avgPrice: 132.5,
              price: 132.5,
            },
          ];
        },
      };

      const mockRouter = {
        executionBroker: mockBroker as any,
        dataBroker: {} as any,
        activeExecutionBrokerName: 'groww',
        activeDataBrokerName: 'groww',
      } as BrokerRouter;

      const syncService = new BrokerOrderSyncService(
        engine,
        mockRouter,
        mockWsManager,
        pino({ level: 'silent' }),
      );

      // Place pending order
      await engine.placeOrder(
        'user-1',
        DUMMY_SIGNAL,
        RISK,
        'idem-sync-2',
        75,
        132.5,
        new Date('2026-11-26T04:15:00.000Z'),
      );
      expect(engine.getOpenPositions()[0].status).toBe('PENDING');

      // Trigger fallback sync
      const syncedCount = await syncService.syncOrderFills();
      expect(syncedCount).toBe(1);

      // Position should be synchronized to OPEN
      expect(engine.getOpenPositions()[0].status).toBe('OPEN');
      expect(engine.getOpenPositions()[0].avgEntryPrice).toBe(132.5);
    } finally {
      process.env['ENABLE_LIVE_TRADING'] = prev;
    }
  });
});
