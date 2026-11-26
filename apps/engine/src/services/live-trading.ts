import type pino from 'pino';
import type { Signal } from '@groww-trading/strategy-core';
import type { GrowwClient } from './groww-client';

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
  closeOrderId?: string;
  closeFilledQuantity?: number;
  totalClosedQuantity?: number;
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
    private growwClient: GrowwClient
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
   * Uses the strategy side for both entries and exits. Requires an option premium;
   * underlying spot is not a valid substitute for an option limit price.
   */
  async placeOrder(
    userId: string,
    signal: Signal,
    risk: LiveRiskConfig,
    idempotencyKey: string,
    quantity = risk.lotSize,
    optionPrice?: number,
    now: Date = new Date()
  ): Promise<{ executed: boolean; order?: LiveOrderResponse; reason?: string }> {
    const existing = this.idempotencyStore.get(idempotencyKey);
    if (existing) {
      this.logger.warn({ idempotencyKey }, 'Duplicate order blocked by idempotency key');
      return { executed: false, order: existing, reason: 'Duplicate idempotency key' };
    }

    if (optionPrice === undefined || !Number.isFinite(optionPrice) || optionPrice <= 0) {
      return { executed: false, reason: 'A valid live option premium is required' };
    }

    const isEntry = !Boolean(signal.metadata?.['isExit']);
    if (signal.isReversal) {
      return { executed: false, reason: 'Reversal signals require explicit close-then-open handling' };
    }
    if (signal.metadata?.['canTrade'] === false || (isEntry && !signal.entryWindowValid)) {
      return { executed: false, reason: 'Signal is not eligible for live execution' };
    }

    const pos = this.positions.get(signal.optionSymbol);
    let orderQuantity = quantity;
    if (isEntry) {
      const executionMode = signal.metadata?.['executionMode'];
      if (executionMode !== 'DEEP_ITM_BUY' && executionMode !== 'ATM_BUY' && executionMode !== 'ATM_SELL') {
        return { executed: false, reason: 'A supported execution mode is required' };
      }
    } else {
      if (!pos || pos.status === 'CLOSED' || pos.status === 'CLOSING') {
        return { executed: false, reason: 'No open position is available to close' };
      }
      orderQuantity = pos.filledQuantity - (pos.totalClosedQuantity ?? 0);
      if (orderQuantity <= 0) {
        return { executed: false, reason: 'No filled quantity remains to close' };
      }
    }

    if (isEntry) {
      const check = this.validateRiskChecks(orderQuantity, risk, now);
      if (!check.allowed) {
        this.logger.warn({ userId, reason: check.reason }, 'Live entry blocked by risk check');
        return { executed: false, reason: check.reason };
      }
    }

    const symbol = signal.optionSymbol;
    const side: 'BUY' | 'SELL' = isEntry
      ? signal.metadata?.['executionMode'] === 'ATM_SELL' ? 'SELL' : 'BUY'
      : pos!.side === 'BUY' ? 'SELL' : 'BUY';

    // NSE Retail Algo Regulation Compliance:
    // Market orders are prohibited for automated retail algo orders.
    // Use marketable LIMIT orders with 1% price protection buffer.
    const bufferMultiplier = side === 'BUY' ? 1.01 : 0.99;
    const limitPrice = Number((optionPrice * bufferMultiplier).toFixed(2));

    const raw = (await this.growwClient.placeOrder({
      symbol,
      exchange: 'NFO',
      quantity: orderQuantity,
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
        targetQuantity: orderQuantity,
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
        pos.closeOrderId = orderId;
        pos.closeFilledQuantity = 0;
      }
    }

    this.logger.info({ userId, symbol, side, quantity: orderQuantity, orderId }, 'Live order submitted');
    return { executed: true, order: orderRes };
  }

  /**
   * Track partial & full fills from Groww WebSocket order updates (S6-005).
   */
  handleOrderUpdate(update: OrderFillUpdate): LivePositionState | undefined {
    for (const pos of this.positions.values()) {
      if (pos.closeOrderId === update.orderId) {
        pos.closeFilledQuantity = update.filledQuantity;
        if (update.status === 'COMPLETE') {
          pos.totalClosedQuantity = (pos.totalClosedQuantity ?? 0) + update.filledQuantity;
          pos.status = pos.totalClosedQuantity >= pos.filledQuantity ? 'CLOSED' : 'OPEN';
          pos.closeOrderId = undefined;
          pos.closeFilledQuantity = 0;
        } else if (update.status === 'REJECTED' || update.status === 'CANCELLED') {
          pos.totalClosedQuantity = (pos.totalClosedQuantity ?? 0) + update.filledQuantity;
          pos.status = pos.totalClosedQuantity >= pos.filledQuantity ? 'CLOSED' : 'OPEN';
          pos.closeOrderId = undefined;
          pos.closeFilledQuantity = 0;
        } else {
          pos.status = 'CLOSING';
        }
        this.logger.info({ orderId: update.orderId, closeFilledQuantity: pos.closeFilledQuantity, status: pos.status }, 'Processed live close-order update');
        return pos;
      }

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
          pos.status = pos.filledQuantity > 0 ? 'OPEN' : 'CLOSED';
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
   * Submit a protected limit square-off and wait for broker fill updates before
   * marking the position closed.
   */
  async squareOffAll(reason = '15:00 IST unconditional square-off'): Promise<number> {
    let requestedCount = 0;
    for (const pos of this.positions.values()) {
      if (pos.status === 'CLOSED' || pos.status === 'CLOSING' || pos.filledQuantity <= 0) continue;
      const qty = pos.filledQuantity - (pos.totalClosedQuantity ?? 0);
      if (qty <= 0) continue;
      const closeSide: 'BUY' | 'SELL' = pos.side === 'BUY' ? 'SELL' : 'BUY';
      const ltp = pos.currentPrice || pos.avgEntryPrice;
      const buffer = closeSide === 'SELL' ? 0.98 : 1.02;
      const limitPrice = Number((ltp * buffer).toFixed(2));

      const raw = (await this.growwClient.placeOrder({
        symbol: pos.optionSymbol,
        exchange: 'NFO',
        quantity: qty,
        side: closeSide,
        orderType: 'LIMIT',
        price: limitPrice,
        product: 'MIS',
        validity: 'DAY',
      })) as { orderId?: string; id?: string } | undefined;

      pos.closeOrderId = raw?.orderId ?? raw?.id;
      pos.closeFilledQuantity = 0;
      pos.status = 'CLOSING';
      requestedCount++;
    }

    if (requestedCount > 0) {
      this.logger.warn({ requestedCount, reason }, 'Submitted protected live square-off orders; awaiting fills');
    }
    return requestedCount;
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
    },
    optionPriceLookup?: (signal: Signal) => Promise<number | undefined> | number | undefined
  ): Promise<Signal[]> {
    const signals: Signal[] = generator.processBar(closedBar);
    for (const sig of signals) {
      const idempotencyKey = `${userId}-${sig.optionSymbol}-${sig.signalType}-${closedBar.barTime.getTime()}`;
      let optionPrice: number | undefined;
      if (optionPriceLookup) {
        try {
          optionPrice = await optionPriceLookup(sig);
        } catch (err) {
          this.logger.warn({ err, symbol: sig.optionSymbol }, 'optionPriceLookup error');
        }
      }
      if (optionPrice === undefined || !Number.isFinite(optionPrice) || optionPrice <= 0) {
        this.logger.error({ userId, symbol: sig.optionSymbol }, 'Live signal rejected: no valid option premium is available');
        continue;
      }
      await this.placeOrder(
        userId,
        sig,
        risk,
        idempotencyKey,
        risk.lotSize,
        optionPrice,
        closedBar.barTime
      );
    }
    return signals;
  }
}
