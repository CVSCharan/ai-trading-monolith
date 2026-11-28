import type pino from 'pino';
import { watchlists } from '../../../api/src/db/schema';
import type { GrowwClient } from './groww-client';
import { createBrokerRouter, type BrokerRouter } from './broker-router';
import { LiveBarAggregator, type ClosedLiveBar } from './live-bar-aggregator';
import { UpstoxMarketDataFeed, type UpstoxFeedTick } from './upstox-ws';

export type TickListener = (tick: UpstoxFeedTick) => void;

export function resolveAggregatorSymbol(instrumentKey: string): string {
  if (instrumentKey === 'NSE_INDEX|Nifty 50') return 'NIFTY';
  if (instrumentKey === 'NSE_INDEX|Nifty Bank') return 'BANKNIFTY';
  const parts = instrumentKey.split('|');
  return parts[1]?.trim() || instrumentKey;
}

export class MarketDataService {
  private logger: pino.Logger;
  private upstoxFeed: UpstoxMarketDataFeed;
  private router: BrokerRouter;
  private barAggregator = new LiveBarAggregator();
  private latestPrices = new Map<string, number>();
  private listeners = new Set<TickListener>();

  constructor(
    private growwClient: GrowwClient,
    private db: unknown,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ component: 'MarketDataService' });
    this.router = createBrokerRouter(growwClient);
    this.upstoxFeed = new UpstoxMarketDataFeed(logger, (tick) => {
      this.latestPrices.set(tick.instrumentKey, tick.ltp);
      const sym = resolveAggregatorSymbol(tick.instrumentKey);
      this.barAggregator.ingestTick(sym, tick.ltp, new Date(tick.timestamp));
      for (const listener of this.listeners) {
        try {
          listener(tick);
        } catch (err) {
          this.logger.warn({ err }, 'Tick listener error');
        }
      }
    });
  }

  onTick(listener: TickListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onBarClose(listener: (bar: ClosedLiveBar) => void): () => void {
    return this.barAggregator.onBarClose(listener);
  }

  getLatestPrice(instrumentKey: string): number | undefined {
    return this.latestPrices.get(instrumentKey);
  }

  getBrokerRouter(): BrokerRouter {
    return this.router;
  }

  async connect(): Promise<void> {
    const keys = new Set<string>(['NSE_INDEX|Nifty 50', 'NSE_INDEX|Nifty Bank']);

    try {
      const dbAny = this.db as { select?: Function } | null;
      if (dbAny && typeof dbAny.select === 'function') {
        const pinned = (await (this.db as any)
          .select({ instrumentKey: watchlists.instrumentKey })
          .from(watchlists)) as Array<{ instrumentKey?: string | null }>;
        for (const row of pinned) {
          if (row.instrumentKey) keys.add(row.instrumentKey);
        }
      }
    } catch (err) {
      this.logger.warn({ err }, 'Could not load watchlist instrument keys; using defaults');
    }

    const instrumentKeys = Array.from(keys);
    this.logger.info(
      {
        activeDataBroker: this.router.activeDataBrokerName,
        activeExecutionBroker: this.router.activeExecutionBrokerName,
        subscriptions: instrumentKeys.length,
      },
      'MarketDataService connecting',
    );
    this.barAggregator.startAutoFlush();
    await this.upstoxFeed.connect(instrumentKeys);
  }

  async disconnect(): Promise<void> {
    this.barAggregator.stopAutoFlush();
    this.upstoxFeed.disconnect();
    this.logger.info('MarketDataService disconnected');
  }
}
