import { createHash } from 'node:crypto';
import type pino from 'pino';
import type { Signal } from '@groww-trading/strategy-core';
import type { GrowwClient } from './groww-client';
import { livePositions, liveFills } from '../../../api/src/db/schema';
import { eq, and, isNull, gte } from 'drizzle-orm';

export interface LiveRiskConfig {
  capital: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
  maxLotsPerOrder: number;
  lotSize: number;
  squareOffMinutesIST?: number; // default 15:00 = 900
  shortOptionStopLossPct?: number; // default 100 (% rise in short option premium)
  longOptionStopLossPct?: number; // optional (% drop in long option premium)
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

export function stringToUuid(str: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  const hash = createHash('sha1').update(str).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
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
    private db: any,
    logger: pino.Logger,
    private growwClient: GrowwClient
  ) {
    this.logger = logger.child({ component: 'LiveTradingEngine' });
  }

  /**
   * Hydrate positions, daily P&L, and idempotency store from PostgreSQL on boot or strategy enable (S19-009).
   */
  async hydratePositionsFromDb(userId: string): Promise<void> {
    if (!this.db) return;

    try {
      const openDbPositions = await this.db
        .select()
        .from(livePositions)
        .where(and(eq(livePositions.userId, userId), isNull(livePositions.closedAt)));

      for (const pos of openDbPositions) {
        const side: 'BUY' | 'SELL' = pos.side === 'LONG' ? 'BUY' : 'SELL';
        this.positions.set(pos.optionSymbol, {
          id: pos.id,
          userId: pos.userId,
          optionSymbol: pos.optionSymbol,
          side,
          targetQuantity: pos.quantity,
          filledQuantity: pos.quantity,
          avgEntryPrice: Number(pos.avgEntryPrice),
          currentPrice: Number(pos.currentPrice ?? pos.avgEntryPrice),
          status: 'OPEN',
          idempotencyKey: pos.id,
        });
      }

      // Restore today's realized PnL
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const closedToday = await this.db
        .select()
        .from(livePositions)
        .where(
          and(
            eq(livePositions.userId, userId),
            gte(livePositions.openedAt, startOfDay)
          )
        );

      let todayPnl = 0;
      for (const p of closedToday) {
        if (p.realizedPnl) {
          todayPnl += Number(p.realizedPnl);
        }
      }
      this.dailyRealizedPnl = todayPnl;

      // Restore recent orders into idempotencyStore
      const recentFills = await this.db
        .select()
        .from(liveFills)
        .where(
          and(
            eq(liveFills.userId, userId),
            gte(liveFills.placedAt, startOfDay)
          )
        );

      for (const fill of recentFills) {
        this.idempotencyStore.set(fill.idempotencyKey, {
          orderId: fill.growwOrderId ?? fill.id,
          status: fill.status,
          filledQuantity: fill.filledQuantity ?? 0,
          avgPrice: Number(fill.avgFillPrice ?? 0),
        });
      }

      this.logger.info(
        { userId, hydratedPositions: openDbPositions.length, dailyRealizedPnl: this.dailyRealizedPnl },
        'Hydrated live positions from PostgreSQL'
      );
    } catch (err) {
      this.logger.error({ err, userId }, 'Failed to hydrate live positions from PostgreSQL');
    }
  }

  /**
   * 5 server-side risk checks before placing any live entry order (S6-002).
   */
  validateRiskChecks(
    quantity: number,
    risk: LiveRiskConfig,
    now: Date = new Date(),
    isReversal = false,
  ): { allowed: boolean; reason?: string } {
    if (process.env['ENABLE_LIVE_TRADING'] !== 'true') {
      return { allowed: false, reason: 'ENABLE_LIVE_TRADING is not true' };
    }

    const squareOffMin = risk.squareOffMinutesIST ?? 15 * 60;
    if (getISTMinutes(now) >= squareOffMin) {
      return { allowed: false, reason: 'Past 15:00 IST square-off cutoff' };
    }

    // On reversal, the active open position is closed immediately, so effective count is openCount - 1
    const activePositions = Array.from(this.positions.values()).filter(
      (p) => p.status === 'OPEN'
    );
    const effectiveOpenCount = isReversal ? Math.max(0, activePositions.length - 1) : activePositions.length;
    if (effectiveOpenCount >= risk.maxOpenPositions) {
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
   * Place a live order with idempotency protection and durable PostgreSQL audit persistence (S6-004, S19-009).
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
    const fillUuid = stringToUuid(idempotencyKey);
    const existing = this.idempotencyStore.get(idempotencyKey) || this.idempotencyStore.get(fillUuid);
    if (existing) {
      this.logger.warn({ idempotencyKey }, 'Duplicate order blocked by in-memory idempotency key');
      return { executed: false, order: existing, reason: 'Duplicate idempotency key' };
    }

    if (this.db) {
      try {
        const [dbExisting] = await this.db
          .select()
          .from(liveFills)
          .where(eq(liveFills.idempotencyKey, fillUuid))
          .limit(1);

        if (dbExisting) {
          const res: LiveOrderResponse = {
            orderId: dbExisting.growwOrderId ?? dbExisting.id,
            status: dbExisting.status,
            filledQuantity: dbExisting.filledQuantity ?? 0,
            avgPrice: Number(dbExisting.avgFillPrice ?? 0),
          };
          this.idempotencyStore.set(idempotencyKey, res);
          this.idempotencyStore.set(fillUuid, res);
          this.logger.warn({ idempotencyKey }, 'Duplicate order blocked by PostgreSQL idempotency record');
          return { executed: false, order: res, reason: 'Duplicate idempotency key in DB' };
        }
      } catch (err) {
        this.logger.warn({ err, idempotencyKey }, 'Failed checking DB idempotency');
      }
    }

    if (optionPrice === undefined || !Number.isFinite(optionPrice) || optionPrice <= 0) {
      return { executed: false, reason: 'A valid live option premium is required' };
    }

    const isEntry = !Boolean(signal.metadata?.['isExit']);
    const isReversal = Boolean(signal.isReversal);

    if (signal.metadata?.['canTrade'] === false || (isEntry && !signal.entryWindowValid)) {
      return { executed: false, reason: 'Signal is not eligible for live execution' };
    }

    // S19-013: Handle sequential reversal (close active leg first, then proceed to enter reverse leg)
    if (isReversal) {
      const activePositions = Array.from(this.positions.values()).filter(
        (p) => p.status === 'OPEN' && p.userId === userId
      );

      for (const openPos of activePositions) {
        const closeSide: 'BUY' | 'SELL' = openPos.side === 'BUY' ? 'SELL' : 'BUY';
        const closeQty = openPos.filledQuantity - (openPos.totalClosedQuantity ?? 0);
        if (closeQty > 0) {
          const ltp = openPos.currentPrice || openPos.avgEntryPrice;
          const buffer = closeSide === 'SELL' ? 0.99 : 1.01;
          const closeLimitPrice = Number((ltp * buffer).toFixed(2));

          this.logger.info(
            { userId, symbol: openPos.optionSymbol, closeSide, closeQty, closeLimitPrice },
            'Submitting exit order to close existing leg on reversal signal'
          );

          const closeRaw = (await this.growwClient.placeOrder({
            symbol: openPos.optionSymbol,
            exchange: 'NFO',
            quantity: closeQty,
            side: closeSide,
            orderType: 'LIMIT',
            price: closeLimitPrice,
            product: 'MIS',
            validity: 'DAY',
          })) as { orderId?: string; id?: string; status?: string } | undefined;

          const closeOrderId = closeRaw?.orderId ?? closeRaw?.id ?? `LIVE-REV-CLOSE-${openPos.id}-${Date.now()}`;
          openPos.closeOrderId = closeOrderId;
          openPos.closeFilledQuantity = 0;
          openPos.status = 'CLOSING';

          if (this.db) {
            try {
              const exitUuid = stringToUuid(`reversal-close-${openPos.id}-${Date.now()}`);
              await this.db.insert(liveFills).values({
                userId,
                growwOrderId: closeOrderId,
                idempotencyKey: exitUuid,
                symbol: (signal.metadata?.['underlyingSymbol'] as string) || openPos.optionSymbol,
                optionSymbol: openPos.optionSymbol,
                side: closeSide,
                orderType: 'LIMIT',
                quantity: closeQty,
                limitPrice: String(closeLimitPrice),
                status: 'OPEN',
                placedAt: new Date(),
                updatedAt: new Date(),
              });

              await this.db.update(livePositions)
                .set({ currentPrice: String(closeLimitPrice) })
                .where(and(eq(livePositions.userId, userId), eq(livePositions.optionSymbol, openPos.optionSymbol), isNull(livePositions.closedAt)));
            } catch (err) {
              this.logger.error({ err, closeOrderId }, 'Failed to persist reversal exit order in PostgreSQL');
            }
          }
        }
      }
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
      const check = this.validateRiskChecks(orderQuantity, risk, now, isReversal);
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
    this.idempotencyStore.set(fillUuid, orderRes);

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

      if (this.db) {
        try {
          const posSide: 'LONG' | 'SHORT' = side === 'BUY' ? 'LONG' : 'SHORT';
          const executeEntry = async (client: any) => {
            await client.insert(liveFills).values({
              userId,
              growwOrderId: orderId,
              idempotencyKey: fillUuid,
              symbol: (signal.metadata?.['underlyingSymbol'] as string) || symbol,
              optionSymbol: symbol,
              side,
              orderType: 'LIMIT',
              quantity: orderQuantity,
              limitPrice: String(limitPrice),
              status: 'OPEN',
              placedAt: new Date(),
              updatedAt: new Date(),
            });

            await client.insert(livePositions).values({
              userId,
              optionSymbol: symbol,
              side: posSide,
              quantity: orderQuantity,
              avgEntryPrice: String(optionPrice),
              currentPrice: String(optionPrice),
              unrealizedPnl: '0',
              realizedPnl: '0',
              openedAt: new Date(),
            });
          };

          if (typeof (this.db as any).transaction === 'function') {
            await (this.db as any).transaction(executeEntry);
          } else {
            await executeEntry(this.db);
          }
        } catch (err) {
          this.logger.error({ err, orderId, symbol }, 'Failed to persist live entry order/position in PostgreSQL');
        }
      }
    } else {
      const existingPos = this.positions.get(symbol);
      if (existingPos) {
        existingPos.status = 'CLOSING';
        existingPos.closeOrderId = orderId;
        existingPos.closeFilledQuantity = 0;
      }

      if (this.db) {
        try {
          const executeExit = async (client: any) => {
            await client.insert(liveFills).values({
              userId,
              growwOrderId: orderId,
              idempotencyKey: fillUuid,
              symbol: (signal.metadata?.['underlyingSymbol'] as string) || symbol,
              optionSymbol: symbol,
              side,
              orderType: 'LIMIT',
              quantity: orderQuantity,
              limitPrice: String(limitPrice),
              status: 'OPEN',
              placedAt: new Date(),
              updatedAt: new Date(),
            });

            await client.update(livePositions)
              .set({ currentPrice: String(limitPrice) })
              .where(and(eq(livePositions.userId, userId), eq(livePositions.optionSymbol, symbol), isNull(livePositions.closedAt)));
          };

          if (typeof (this.db as any).transaction === 'function') {
            await (this.db as any).transaction(executeExit);
          } else {
            await executeExit(this.db);
          }
        } catch (err) {
          this.logger.error({ err, orderId, symbol }, 'Failed to persist live exit order in PostgreSQL');
        }
      }
    }

    this.logger.info({ userId, symbol, side, quantity: orderQuantity, orderId }, 'Live order submitted');
    return { executed: true, order: orderRes };
  }

  /**
   * Track partial & full fills from Groww WebSocket order updates and persist to PostgreSQL (S6-005, S19-009).
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

        if (this.db) {
          void (async () => {
            try {
              await this.db.update(liveFills)
                .set({
                  status: update.status,
                  filledQuantity: update.filledQuantity,
                  avgFillPrice: String(update.avgFillPrice),
                  updatedAt: new Date(),
                  completedAt: update.status === 'COMPLETE' ? new Date() : null,
                })
                .where(eq(liveFills.growwOrderId, update.orderId));

              if (pos.status === 'CLOSED') {
                const pnl = pos.side === 'BUY'
                  ? (update.avgFillPrice - pos.avgEntryPrice) * pos.filledQuantity
                  : (pos.avgEntryPrice - update.avgFillPrice) * pos.filledQuantity;
                this.dailyRealizedPnl += pnl;

                await this.db.update(livePositions)
                  .set({
                    closedAt: new Date(),
                    closedReason: 'TARGET_OR_SL',
                    currentPrice: String(update.avgFillPrice),
                    realizedPnl: String(pnl.toFixed(2)),
                  })
                  .where(and(eq(livePositions.userId, pos.userId), eq(livePositions.optionSymbol, pos.optionSymbol), isNull(livePositions.closedAt)));
              }
            } catch (err) {
              this.logger.error({ err, orderId: update.orderId }, 'Failed persisting close order fill update in PostgreSQL');
            }
          })();
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

        if (this.db) {
          void (async () => {
            try {
              await this.db.update(liveFills)
                .set({
                  status: update.status,
                  filledQuantity: update.filledQuantity,
                  avgFillPrice: String(update.avgFillPrice),
                  updatedAt: new Date(),
                  completedAt: update.status === 'COMPLETE' ? new Date() : null,
                })
                .where(eq(liveFills.growwOrderId, update.orderId));

              await this.db.update(livePositions)
                .set({
                  quantity: pos.filledQuantity,
                  avgEntryPrice: String(pos.avgEntryPrice),
                  currentPrice: String(pos.currentPrice),
                  closedAt: pos.status === 'CLOSED' ? new Date() : null,
                  closedReason: pos.status === 'CLOSED' ? 'REJECTED_OR_CANCELLED' : null,
                })
                .where(and(eq(livePositions.userId, pos.userId), eq(livePositions.optionSymbol, pos.optionSymbol), isNull(livePositions.closedAt)));
            } catch (err) {
              this.logger.error({ err, orderId: update.orderId }, 'Failed persisting entry order fill update in PostgreSQL');
            }
          })();
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
   * Submit a protected limit close order for a single open position and record it in liveFills.
   */
  private async submitProtectedClose(
    pos: LivePositionState,
    ltp: number,
    reason: string
  ): Promise<boolean> {
    if (pos.status === 'CLOSED' || pos.status === 'CLOSING' || pos.filledQuantity <= 0) return false;
    const qty = pos.filledQuantity - (pos.totalClosedQuantity ?? 0);
    if (qty <= 0) return false;

    const closeSide: 'BUY' | 'SELL' = pos.side === 'BUY' ? 'SELL' : 'BUY';
    const refPrice = ltp > 0 ? ltp : pos.currentPrice || pos.avgEntryPrice;
    const buffer = closeSide === 'SELL' ? 0.98 : 1.02;
    const limitPrice = Number((refPrice * buffer).toFixed(2));

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

    const orderId = raw?.orderId ?? raw?.id;
    pos.closeOrderId = orderId;
    pos.closeFilledQuantity = 0;
    pos.status = 'CLOSING';

    if (this.db && orderId) {
      try {
        const sqOffIdempotency = stringToUuid(`close-${pos.id}-${Date.now()}`);
        await this.db.insert(liveFills).values({
          userId: pos.userId,
          growwOrderId: orderId,
          idempotencyKey: sqOffIdempotency,
          symbol: pos.optionSymbol,
          optionSymbol: pos.optionSymbol,
          side: closeSide,
          orderType: 'LIMIT',
          quantity: qty,
          limitPrice: String(limitPrice),
          status: 'OPEN',
          placedAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (err) {
        this.logger.error({ err, orderId, reason }, 'Failed to persist close fill record in PostgreSQL');
      }
    }

    this.logger.warn({ symbol: pos.optionSymbol, closeSide, qty, limitPrice, reason }, 'Submitted protected close order');
    return true;
  }

  /**
   * Enforce per-trade option premium stop-loss on incoming option ticks (GAP-05).
   */
  async onOptionTick(
    optionSymbol: string,
    ltp: number,
    risk?: Pick<LiveRiskConfig, 'shortOptionStopLossPct' | 'longOptionStopLossPct'>
  ): Promise<boolean> {
    if (!Number.isFinite(ltp) || ltp <= 0) return false;
    const pos = this.positions.get(optionSymbol);
    if (!pos || pos.status !== 'OPEN' || pos.filledQuantity <= 0 || pos.avgEntryPrice <= 0) {
      return false;
    }

    pos.currentPrice = ltp;

    if (pos.side === 'SELL') {
      const stopPct = risk?.shortOptionStopLossPct ?? 100;
      const lossPct = ((ltp - pos.avgEntryPrice) / pos.avgEntryPrice) * 100;
      if (lossPct >= stopPct) {
        return this.submitProtectedClose(
          pos,
          ltp,
          `SHORT_OPTION_SL (${lossPct.toFixed(1)}% >= ${stopPct}%)`
        );
      }
    } else if (pos.side === 'BUY' && risk?.longOptionStopLossPct !== undefined) {
      const stopPct = risk.longOptionStopLossPct;
      const lossPct = ((pos.avgEntryPrice - ltp) / pos.avgEntryPrice) * 100;
      if (lossPct >= stopPct) {
        return this.submitProtectedClose(
          pos,
          ltp,
          `LONG_OPTION_SL (${lossPct.toFixed(1)}% >= ${stopPct}%)`
        );
      }
    }

    return false;
  }

  /**
   * Submit a protected limit square-off, persist exit orders, and wait for broker fill updates before
   * marking the position closed.
   */
  async squareOffAll(reason = '15:00 IST unconditional square-off'): Promise<number> {
    let requestedCount = 0;
    for (const pos of this.positions.values()) {
      const closed = await this.submitProtectedClose(pos, pos.currentPrice || pos.avgEntryPrice, reason);
      if (closed) requestedCount++;
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
