import type pino from 'pino';
import type { GrowwClient } from './groww-client';

export class MarketDataService {
  private logger: pino.Logger;

  constructor(
    private growwClient: GrowwClient,
    private db: unknown,
    logger: pino.Logger
  ) {
    this.logger = logger.child({ component: 'MarketDataService' });
  }

  async connect(): Promise<void> {
    this.logger.info('MarketDataService stub connected');
  }

  async disconnect(): Promise<void> {
    this.logger.info('MarketDataService stub disconnected');
  }
}
