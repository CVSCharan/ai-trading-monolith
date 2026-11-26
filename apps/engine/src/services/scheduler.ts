import cron, { type ScheduledTask } from 'node-cron';
import pino from 'pino';
import { eq } from 'drizzle-orm';
import { getISTDateString } from '@groww-trading/shared';
import { resampleCandles, type Candle1m } from '@groww-trading/strategy-core';
import { candles1m, candlesResampled, instruments } from '../../../api/src/db/schema';
import type { GrowwClient } from './groww-client';

export class TradingScheduler {
  private logger: pino.Logger;
  private tasks: ScheduledTask[] = [];

  constructor(
    private db: any,
    logger: pino.Logger,
    private growwClient: GrowwClient
  ) {
    this.logger = logger.child({ component: 'TradingScheduler' });
  }

  start(): void {
    // 08:45 IST weekdays — pre-market Groww TOTP token refresh before 09:15 IST open
    this.tasks.push(
      cron.schedule(
        '45 8 * * 1-5',
        () => {
          void this.refreshBrokerTokens();
        },
        { timezone: 'Asia/Kolkata' }
      )
    );

    // 15:30 IST weekdays — download & resample today's 1m candles
    this.tasks.push(
      cron.schedule(
        '30 15 * * 1-5',
        () => {
          void this.downloadAndResampleToday();
        },
        { timezone: 'Asia/Kolkata' }
      )
    );

    // 09:00 IST Mondays — sync active option chain instruments
    this.tasks.push(
      cron.schedule(
        '0 9 * * 1',
        () => {
          void this.syncInstrumentMaster();
        },
        { timezone: 'Asia/Kolkata' }
      )
    );

    this.logger.info('TradingScheduler started (IST cron jobs registered)');
  }

  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    this.logger.info('TradingScheduler stopped');
  }

  async refreshBrokerTokens(): Promise<void> {
    try {
      await this.growwClient.initialize();
      this.logger.info('Pre-market Groww TOTP token refreshed successfully');
    } catch (err) {
      this.logger.error({ err }, 'Pre-market Groww TOTP token refresh failed');
    }
  }

  async downloadAndResampleToday(): Promise<void> {
    const todayStr = getISTDateString(new Date());
    const from = new Date(`${todayStr}T03:45:00.000Z`); // 09:15 IST
    const to = new Date(`${todayStr}T10:00:00.000Z`);   // 15:30 IST

    try {
      const indexInstruments = await this.db
        .select()
        .from(instruments)
        .where(eq(instruments.instrumentType, 'INDEX'));

      for (const inst of indexInstruments) {
        if (!inst.isActive) continue;
        const resp = (await this.growwClient.getHistoricalCandles(
          inst.symbol,
          '1m',
          from,
          to
        )) as {
          candles?: Array<[number, number, number, number, number, number]>;
          payload?: { candles?: Array<[number, number, number, number, number, number]> };
        };

        const rawCandles = resp?.payload?.candles ?? resp?.candles ?? [];
        if (rawCandles.length === 0) continue;

        const mapped1m: Candle1m[] = rawCandles.map(([ts, open, high, low, close, volume]) => ({
          instrumentId: inst.id,
          barTime: new Date(ts * 1000),
          open,
          high,
          low,
          close,
          volume,
        }));

        await this.db
          .insert(candles1m)
          .values(
            mapped1m.map((c) => ({
              instrumentId: c.instrumentId,
              barTime: c.barTime,
              open: c.open.toFixed(4),
              high: c.high.toFixed(4),
              low: c.low.toFixed(4),
              close: c.close.toFixed(4),
              volume: c.volume,
            }))
          )
          .onConflictDoNothing();

        for (const tf of ['5m', '15m', '30m'] as const) {
          const resampled = resampleCandles(mapped1m, tf);
          if (resampled.length === 0) continue;

          await this.db
            .insert(candlesResampled)
            .values(
              resampled.map((r) => ({
                instrumentId: r.instrumentId,
                timeframe: r.timeframe,
                barTime: r.barTime,
                open: r.open.toFixed(4),
                high: r.high.toFixed(4),
                low: r.low.toFixed(4),
                close: r.close.toFixed(4),
                volume: r.volume,
              }))
            )
            .onConflictDoNothing();
        }
      }

      this.logger.info({ date: todayStr }, 'Daily candle download & resample complete');
    } catch (err) {
      this.logger.error({ err, date: todayStr }, 'Daily candle download failed');
    }
  }

  async syncInstrumentMaster(): Promise<void> {
    try {
      const chain = await this.growwClient.getOptionChain('NIFTY', '');
      this.logger.info({ hasChain: Boolean(chain) }, 'Weekly instrument master sync executed');
    } catch (err) {
      this.logger.error({ err }, 'Weekly instrument master sync failed');
    }
  }
}
