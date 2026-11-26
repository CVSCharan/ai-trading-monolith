import { describe, expect, test } from 'bun:test';
import pino from 'pino';
import { TradingScheduler } from '../src/services/scheduler';
import type { MarketAlertScheduleItem } from '@groww-trading/shared';

describe('Sprint 18 - Multi-Market Scheduler Lifecycle Alerts (S18-002)', () => {
  const logger = pino({ level: 'silent' });

  test('dispatches market alert to WebSocket and structured AlertingService', async () => {
    const wsBroadcasts: Array<{ channel: string; data: any }> = [];
    const mockWsManager = {
      broadcast: (channel: string, data: any) => {
        wsBroadcasts.push({ channel, data });
      },
    } as any;

    const structuredAlerts: any[] = [];
    const mockAlerting = {
      sendAlert: async (payload: any) => {
        structuredAlerts.push(payload);
      },
    } as any;

    const mockGrowwClient = {} as any;
    const mockDb = {} as any;

    const scheduler = new TradingScheduler(
      mockDb,
      logger,
      mockGrowwClient,
      mockAlerting,
      mockWsManager
    );

    const testItem: MarketAlertScheduleItem = {
      marketId: 'NSE_FNO',
      marketName: 'NSE F&O',
      eventType: 'MARKET_CLOSING_SOON',
      timeIST: '15:20',
      cronExpr: '20 15 * * 1-5',
      message: '⚠️ Closing in 10 mins: NSE F&O closes at 15:30 IST.',
    };

    // Force alert trigger
    await scheduler.handleMarketAlert(testItem, true);

    expect(wsBroadcasts.length).toBe(1);
    expect(wsBroadcasts[0]?.channel).toBe('market_alerts');
    expect(wsBroadcasts[0]?.data.marketId).toBe('NSE_FNO');
    expect(wsBroadcasts[0]?.data.eventType).toBe('MARKET_CLOSING_SOON');

    expect(structuredAlerts.length).toBe(1);
    expect(structuredAlerts[0]?.severity).toBe('WARNING');
    expect(structuredAlerts[0]?.event).toBe('MARKET_CLOSING_SOON');
    expect(structuredAlerts[0]?.message).toContain('Closing in 10 mins');
  });

  test('registers all cron jobs on start and deregisters on stop', () => {
    const mockGrowwClient = {} as any;
    const mockDb = {} as any;
    const scheduler = new TradingScheduler(mockDb, logger, mockGrowwClient);

    scheduler.start();
    // 3 base crons (token refresh, resample, sync) + 28 market lifecycle crons = 31 total
    expect((scheduler as any).tasks.length).toBeGreaterThanOrEqual(31);

    scheduler.stop();
    expect((scheduler as any).tasks.length).toBe(0);
  });
});
