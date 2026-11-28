import cron, { type ScheduledTask } from 'node-cron';
import pino from 'pino';
import { eq } from 'drizzle-orm';
import {
  getISTDateString,
  getMarketAlertSchedules,
  type MarketAlertScheduleItem,
} from '@groww-trading/shared';
import { resampleCandles, type Candle1m } from '@groww-trading/strategy-core';
import { candles1m, candlesResampled, instruments } from '../../../api/src/db/schema';
import type { GrowwClient } from './groww-client';
import type { AlertingService } from './alerting';
import type { WebSocketManager } from './websocket-manager';
import { isNSETradingDay } from './nse-holidays';

export class TradingScheduler {
  private logger: pino.Logger;
  private tasks: ScheduledTask[] = [];

  constructor(
    private db: any,
    logger: pino.Logger,
    private growwClient: GrowwClient,
    private alerting?: AlertingService,
    private wsManager?: WebSocketManager
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

    // Multi-market lifecycle alerts (Open, -10m Pre-close, Close, +10m Post-close)
    const alertItems = getMarketAlertSchedules();
    for (const item of alertItems) {
      this.tasks.push(
        cron.schedule(
          item.cronExpr,
          () => {
            void this.handleMarketAlert(item);
          },
          { timezone: 'Asia/Kolkata' }
        )
      );
    }

    this.logger.info(
      { scheduledTasks: this.tasks.length, marketAlertTasks: alertItems.length },
      'TradingScheduler started (IST cron jobs registered)'
    );
  }

  async handleMarketAlert(item: MarketAlertScheduleItem, force = false): Promise<void> {
    const now = new Date();
    if (!force && !isNSETradingDay(now)) {
      this.logger.debug({ item }, 'Skipping market alert on non-trading day');
      return;
    }

    const payload = {
      marketId: item.marketId,
      marketName: item.marketName,
      eventType: item.eventType,
      timeIST: item.timeIST,
      message: item.message,
      timestamp: now.toISOString(),
    };

    if (this.wsManager) {
      this.wsManager.broadcast('market_alerts', payload);
    }

    if (this.alerting) {
      await this.alerting.sendAlert({
        severity: item.eventType === 'MARKET_CLOSING_SOON' ? 'WARNING' : 'INFO',
        event: item.eventType,
        message: item.message,
        metadata: {
          marketId: item.marketId,
          marketName: item.marketName,
          timeIST: item.timeIST,
        },
      });
    }

    this.logger.info({ alert: payload }, `[MarketAlert] ${item.eventType}: ${item.message}`);
  }


  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    this.logger.info('TradingScheduler stopped');
  }

  async refreshBrokerTokens(): Promise<void> {
    if (!isNSETradingDay(new Date())) {
      this.logger.info('NSE holiday/weekend — skipping pre-market token refresh');
      return;
    }
    try {
      await this.growwClient.initialize();
      this.logger.info('Pre-market Groww TOTP token refreshed successfully');
    } catch (err) {
      this.logger.error({ err }, 'Pre-market Groww TOTP token refresh failed');
    }
  }

  async downloadAndResampleToday(): Promise<void> {
    if (!isNSETradingDay(new Date())) {
      this.logger.info('NSE holiday/weekend — skipping daily candle download');
      return;
    }
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
    const todayStr = getISTDateString(new Date());
    let upserted = 0;

    for (const underlying of ['NIFTY', 'BANKNIFTY'] as const) {
      try {
        const raw = (await this.growwClient.getOptionChain(underlying, '')) as {
          strikes?: Array<Record<string, any>>;
          data?: Array<Record<string, any>>;
        } | null;

        const rows = raw?.strikes ?? raw?.data ?? [];
        for (const row of rows) {
          const strike = Number(row['strike_price'] ?? row['strikePrice'] ?? 0);
          if (!Number.isFinite(strike) || strike <= 0) continue;

          for (const optType of ['CE', 'PE'] as const) {
            const leg = (row[optType] ?? row[optType.toLowerCase()]) as Record<string, any> | undefined;
            const token = String(leg?.['trading_symbol'] ?? leg?.['growwToken'] ?? '');
            if (!token) continue;

            const lotSize = Number(leg?.['lot_size'] ?? (underlying === 'NIFTY' ? 75 : 30));
            const expiryStr = leg?.['expiry_date'] ? String(leg['expiry_date']).slice(0, 10) : null;

            await this.db
              .insert(instruments)
              .values({
                symbol: underlying,
                instrumentType: 'OPT',
                exchange: 'NSE',
                segment: 'FO',
                lotSize,
                strikeStep: underlying === 'NIFTY' ? 50 : 100,
                underlyingSymbol: underlying,
                strikePrice: strike.toFixed(2),
                optionType: optType,
                expiryDate: expiryStr,
                expiryType: 'WEEKLY',
                isActive: true,
                validFrom: todayStr,
                growwToken: token,
              })
              .onConflictDoUpdate({
                target: instruments.growwToken,
                set: {
                  lotSize,
                  isActive: true,
                },
              });
            upserted++;
          }
        }
      } catch (err) {
        this.logger.warn({ err, underlying }, 'Instrument master sync failed for underlying');
      }
    }

    this.logger.info({ upserted }, 'Weekly instrument master sync complete');
  }
}
