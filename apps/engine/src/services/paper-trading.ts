import type pino from 'pino';
import type { GrowwClient } from './groww-client';
import type { MarketDataService } from './market-data';

export class PaperTradingEngine {
  private logger: pino.Logger;

  constructor(
    private db: unknown,
    logger: pino.Logger,
    private growwClient: GrowwClient,
    private marketData: MarketDataService
  ) {
    this.logger = logger.child({ component: 'PaperTradingEngine' });
  }
}
