import type pino from 'pino';
import type { Signal } from '@groww-trading/strategy-core';
import type { GrowwClient } from './groww-client';
import type { MarketDataService } from './market-data';

export interface LiveRiskConfig {
  capital: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
  maxLotsPerOrder: number;
  lotSize: number;
  squareOffMinutesIST?: number; // default 15:00 = 900
}

export interface LivePositionState {
  id: string;
  userId: string;
  optionSymbol: string;
  side: 'BUY' | 'SELL';
  targetQuantity: number;
  filledQuantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  status: 'PENDING' | 'PARTIAL' | 'OPEN' | 'CLOSING' | 'CLOSED';
  idempotencyKey: string;
  orderId?: string;
}

export interface OrderFillUpdate {
  orderId: string;
  idempotencyKey?: string;
  filledQuantity: number;
  avgFillPrice: number;
  status: 'OPEN' | 'PARTIAL' | 'COMPLETE' | 'REJECTED' | 'CANCELLED';
}

export interface LiveOrderResponse {
  orderId: string;
  status: string;
  filledQuantity?: number;
  avgPrice?: number;
}

function getISTMinutes(date: Date): number {
  const ist = new Date(date.getTime() + 330 * 60_000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

export class LiveTradingEngine {
  private logger: pino.Logger;
  private positions = new Map<string, LivePositionState>();
  private idempotencyStore = new Map<string, LiveOrderResponse>();
  private dailyRealizedPnl = 0;

  constructor(
    private db: unknown,
    logger: pino.Logger,
    private growwClient: GrowwClient,
    private marketData: MarketDataService
  ) {
    this.logger = logger.child({ component: 'LiveTradingEngine' });
  }

  /**
   * 5 server-side risk checks before placing any live entry order (S6-002).
   */
  validateRiskChecks(
    quantity: number,
    risk: LiveRiskConfig,
    now: Date = new Date()
  ): { allowed: boolean; reason?: string } {
    if (process.env['ENABLE_LIVE_TRADING'] !== 'true') {
      return { allowed: false, reason: 'ENABLE_LIVE_TRADING is not true' };
    }

    const squareOffMin = risk.squareOffMinutesIST ?? 15 * 60;
    if (getISTMinutes(now) >= squareOffMin) {
      return { allowed: false, reason: 'Past 15:00 IST square-off cutoff' };
    }

    const openCount = Array.from(this.positions.values()).filter(
      (p) => p.status !== 'CLOSED'
    ).length;
    if (openCount >= risk.maxOpenPositions) {
      return { allowed: false, reason: `Max open positions (${risk.maxOpenPositions}) reached` };
    }

    const maxLoss = (risk.capital * risk.maxDailyLossPct) / 100;
    if (this.dailyRealizedPnl <= -maxLoss) {
      return { allowed: false, reason: `Daily loss limit (${risk.maxDailyLossPct}%) breached` };
    }

    const lots = Math.max(1, Math.round(quantity / risk.lotSize));
    if (lots > risk.maxLotsPerOrder) {
      return { allowed: false, reason: `Order lots (${lots}) exceeds maxLotsPerOrder (${risk.maxLotsPerOrder})` };
    }

    return { allowed: true };
  }

  /**
   * Place a live order with idempotency protection (S6-004).
   * Market order for entry; limit order for exit (S6-002).
   */
  async placeOrder(
    userId: string,
    signal: Signal,
    risk: LiveRiskConfig,
    idempotencyKey: string,
    quantity = risk.lotSize,
    optionPrice = signal.spotPrice,
    now: Date = new Date()
  ): Promise<{ executed: boolean; order?: LiveOrderResponse; reason?: string }> {
    const existing = this.idempotencyStore.get(idempotencyKey);
    if (existing) {
      this.logger.warn({ idempotencyKey }, 'Duplicate order blocked by idempotency key');
      return { executed: false, order: existing, reason: 'Duplicate idempotency key' };
    }

    const isEntry = String(signal.signalType).startsWith('ENTRY');
    if (isEntry) {
      const check = this.validateRiskChecks(quantity, risk, now);
      if (!check.allowed) {
        this.logger.warn({ userId, reason: check.reason }, 'Live entry blocked by risk check');
        return { executed: false, reason: check.reason };
      }
    }

    const symbol = signal.optionSymbol;
    const side: 'BUY' | 'SELL' = isEntry ? 'BUY' : 'SELL';

    // NSE Retail Algo Regulation Compliance:
    // Market orders are prohibited for automated retail algo orders.
    // Use marketable LIMIT orders with 1% price protection buffer.
    const bufferMultiplier = isEntry ? 1.01 : 0.99;
    const limitPrice = Number((optionPrice * bufferMultiplier).toFixed(2));

    const raw = (await this.growwClient.placeOrder({
      symbol,
      exchange: 'NFO',
      quantity,
      side,
      orderType: 'LIMIT',
      price: limitPrice,
      product: 'MIS',
      validity: 'DAY',
    })) as { orderId?: string; id?: string; status?: string } | undefined;

    const orderId = raw?.orderId ?? raw?.id ?? `LIVE-${idempotencyKey}`;
    const orderRes: LiveOrderResponse = {
      orderId,
      status: raw?.status ?? 'OPEN',
    };
    this.idempotencyStore.set(idempotencyKey, orderRes);

    if (isEntry) {
      this.positions.set(symbol, {
        id: orderId,
        userId,
        optionSymbol: symbol,
        side,
        targetQuantity: quantity,
        filledQuantity: 0,
        avgEntryPrice: optionPrice,
        currentPrice: optionPrice,
        status: 'PENDING',
        idempotencyKey,
        orderId,
      });
    } else {
      const pos = this.positions.get(symbol);
      if (pos) {
        pos.status = 'CLOSING';
      }
    }

    this.logger.info({ userId, symbol, side, quantity, orderId }, 'Live order submitted');
    return { executed: true, order: orderRes };
  }

  /**
   * Track partial & full fills from Groww WebSocket order updates (S6-005).
   */
  handleOrderUpdate(update: OrderFillUpdate): LivePositionState | undefined {
    for (const pos of this.positions.values()) {
      if (pos.orderId === update.orderId || pos.idempotencyKey === update.idempotencyKey) {
        pos.filledQuantity = update.filledQuantity;
        if (update.avgFillPrice > 0) {
          pos.avgEntryPrice = update.avgFillPrice;
          pos.currentPrice = update.avgFillPrice;
        }
        if (update.status === 'COMPLETE') {
          pos.status = pos.status === 'CLOSING' ? 'CLOSED' : 'OPEN';
        } else if (update.status === 'PARTIAL') {
          pos.status = 'PARTIAL';
        } else if (update.status === 'REJECTED' || update.status === 'CANCELLED') {
          pos.status = 'CLOSED';
        }
        this.logger.info(
          {
            orderId: update.orderId,
            filledQuantity: pos.filledQuantity,
            avgEntryPrice: pos.avgEntryPrice,
            status: pos.status,
          },
          'Processed live order fill update'
        );
        return pos;
      }
    }
    return undefined;
  }

  /**
   * Unconditional 15:00 IST or emergency market square-off (S6-003).
   */
  async squareOffAll(reason = '15:00 IST unconditional square-off'): Promise<number> {
    let closedCount = 0;
    for (const pos of this.positions.values()) {
      if (pos.status === 'CLOSED') continue;
      const qty = pos.filledQuantity > 0 ? pos.filledQuantity : pos.targetQuantity;
      const closeSide: 'BUY' | 'SELL' = pos.side === 'BUY' ? 'SELL' : 'BUY';
      const ltp = pos.currentPrice || pos.avgEntryPrice;
      const buffer = closeSide === 'SELL' ? 0.98 : 1.02;
      const limitPrice = Number((ltp * buffer).toFixed(2));

      await this.growwClient.placeOrder({
        symbol: pos.optionSymbol,
        exchange: 'NFO',
        quantity: qty,
        side: closeSide,
        orderType: 'LIMIT',
        price: limitPrice,
        product: 'MIS',
        validity: 'DAY',
      });

      pos.status = 'CLOSED';
      closedCount++;
    }

    if (closedCount > 0) {
      this.logger.warn({ closedCount, reason }, 'Executed unconditional live square-off');
    }
    return closedCount;
  }

  getOpenPositions(): LivePositionState[] {
    return Array.from(this.positions.values()).filter((p) => p.status !== 'CLOSED');
  }

  /**
   * Process closed market bars through live strategy signal generators.
   */
  async onBarClose(
    userId: string,
    generator: any,
    closedBar: {
      instrumentId: number;
      timeframe: string;
      barTime: Date;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    },
    instruments: any[],
    risk: LiveRiskConfig = {
      capital: 1000000,
      maxDailyLossPct: 2,
      maxOpenPositions: 3,
      lotSize: 25,
      maxLotsPerOrder: 4,
    }
  ): Promise<Signal[]> {
    const signals: Signal[] = generator.processBar(closedBar);
    for (const sig of signals) {
      const idempotencyKey = `${userId}-${sig.optionSymbol}-${sig.signalType}-${closedBar.barTime.getTime()}`;
      await this.placeOrder(
        userId,
        sig,
        risk,
        idempotencyKey,
        risk.lotSize,
        sig.spotPrice,
        closedBar.barTime
      );
    }
    return signals;
  }
}
