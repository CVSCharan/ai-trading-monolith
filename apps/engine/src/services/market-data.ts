import type pino from 'pino';
import type { GrowwClient } from './groww-client';
import { createBrokerRouter, type BrokerRouter } from './broker-router';
import { LiveBarAggregator, type ClosedLiveBar } from './live-bar-aggregator';
import { UpstoxMarketDataFeed, type UpstoxFeedTick } from './upstox-ws';

export type TickListener = (tick: UpstoxFeedTick) => void;

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
      const sym = tick.instrumentKey.includes('Bank') ? 'BANKNIFTY' : 'NIFTY';
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
    this.logger.info(
      {
        activeDataBroker: this.router.activeDataBrokerName,
        activeExecutionBroker: this.router.activeExecutionBrokerName,
      },
      'MarketDataService connecting',
    );
    await this.upstoxFeed.connect(['NSE_INDEX|Nifty 50', 'NSE_INDEX|Nifty Bank']);
  }

  async disconnect(): Promise<void> {
    this.upstoxFeed.disconnect();
    this.logger.info('MarketDataService disconnected');
  }
}
