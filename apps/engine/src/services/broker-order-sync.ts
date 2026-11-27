// ============================================
// BrokerOrderSyncService (S19-008: Broker Order Fill Stream & Sync Ingestion)
// Subscribes to real-time fill events & runs resilient fallback poll
// ============================================

import type pino from 'pino';
import type { LiveTradingEngine, OrderFillUpdate } from './live-trading';
import type { BrokerRouter } from './broker-router';
import type { WebSocketManager } from './websocket-manager';

export interface BrokerOrderSyncConfig {
  pollIntervalMs?: number; // default 10_000ms
}

export class BrokerOrderSyncService {
  private logger: pino.Logger;
  private pollIntervalMs: number;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  constructor(
    private liveEngine: LiveTradingEngine,
    private router: BrokerRouter,
    private wsManager: WebSocketManager,
    logger: pino.Logger,
    config: BrokerOrderSyncConfig = {},
  ) {
    this.logger = logger.child({ component: 'BrokerOrderSyncService' });
    this.pollIntervalMs = config.pollIntervalMs ?? 10_000;
  }

  start(): void {
    if (this.intervalHandle) return;
    this.logger.info(
      { pollIntervalMs: this.pollIntervalMs, broker: this.router.activeExecutionBrokerName },
      'BrokerOrderSyncService started',
    );
    this.intervalHandle = setInterval(() => {
      void this.syncOrderFills();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.info('BrokerOrderSyncService stopped');
  }

  /**
   * Direct ingestion method for incoming broker WebSocket order fill events.
   */
  ingestFillUpdate(update: OrderFillUpdate): void {
    try {
      const updatedPos = this.liveEngine.handleOrderUpdate(update);
      this.wsManager.broadcast('orders', {
        type: 'ORDER_FILL_UPDATE',
        update,
        timestamp: new Date().toISOString(),
      });
      if (updatedPos) {
        this.wsManager.broadcast('positions', {
          type: 'POSITION_UPDATE',
          position: updatedPos,
          timestamp: new Date().toISOString(),
        });
      }
      this.logger.info(
        { orderId: update.orderId, status: update.status, filledQuantity: update.filledQuantity },
        'Ingested live order fill update',
      );
    } catch (err) {
      this.logger.error({ err, orderId: update.orderId }, 'Failed ingesting order fill update');
    }
  }

  /**
   * Periodic fallback synchronizer: queries execution broker order book
   * and dispatches updates for any pending or closing positions.
   */
  async syncOrderFills(): Promise<number> {
    if (this.isSyncing) return 0;
    this.isSyncing = true;

    try {
      // Only poll when there are open or closing positions in liveEngine
      const openPositions = this.liveEngine.getOpenPositions();
      const hasTrackedOrders = openPositions.some(
        (p) => (p.status === 'PENDING' && p.orderId) || (p.status === 'CLOSING' && p.closeOrderId),
      );

      if (!hasTrackedOrders) {
        return 0;
      }

      const broker = this.router.executionBroker;
      if (!broker.getOrderBook) {
        return 0;
      }

      const orderBook = await broker.getOrderBook();
      let syncedCount = 0;

      for (const pos of openPositions) {
        // 1. Check entry order
        if (pos.status === 'PENDING' && pos.orderId) {
          const match = orderBook.find((o) => o.orderId === pos.orderId);
          if (
            match &&
            (match.status === 'COMPLETE' ||
              match.status === 'PARTIAL' ||
              match.status === 'REJECTED' ||
              match.status === 'CANCELLED')
          ) {
            this.ingestFillUpdate({
              orderId: match.orderId,
              filledQuantity: match.filledQuantity,
              avgFillPrice: match.avgPrice > 0 ? match.avgPrice : match.price,
              status: match.status,
            });
            syncedCount++;
          }
        }

        // 2. Check exit order
        if (pos.status === 'CLOSING' && pos.closeOrderId) {
          const match = orderBook.find((o) => o.orderId === pos.closeOrderId);
          if (
            match &&
            (match.status === 'COMPLETE' || match.status === 'REJECTED' || match.status === 'CANCELLED')
          ) {
            this.ingestFillUpdate({
              orderId: match.orderId,
              filledQuantity: match.filledQuantity > 0 ? match.filledQuantity : pos.filledQuantity,
              avgFillPrice: match.avgPrice > 0 ? match.avgPrice : pos.currentPrice,
              status: match.status,
            });
            syncedCount++;
          }
        }
      }

      return syncedCount;
    } catch (err) {
      this.logger.warn({ err }, 'Error during periodic broker order sync poll');
      return 0;
    } finally {
      this.isSyncing = false;
    }
  }
}
