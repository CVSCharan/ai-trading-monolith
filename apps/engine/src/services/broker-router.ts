// ============================================
// Broker Router (S11-001: Dual-Broker Engine Routing)
// Wraps GrowwClient & UpstoxClient under BrokerAdapter
// ============================================

import type {
  BrokerAdapter,
  BrokerCandle,
  BrokerMarginInfo,
  BrokerName,
  BrokerOrderRequest,
  BrokerOrderResult,
  BrokerPosition,
  BrokerQuote,
} from '@groww-trading/shared';
import { UpstoxClient } from './upstox-client';
import type { GrowwClient } from './groww-client';

export class GrowwBrokerAdapter implements BrokerAdapter {
  readonly name = 'groww' as const;

  constructor(private readonly client: GrowwClient) {}

  async getHistoricalCandles(params: {
    symbol: string;
    interval: '1m' | '5m' | '15m' | '30m' | '1d';
    fromDate: string;
    toDate: string;
  }): Promise<BrokerCandle[]> {
    const res = (await this.client.getHistoricalCandles(
      params.symbol,
      params.interval,
      new Date(params.fromDate),
      new Date(params.toDate),
    )) as { payload?: { candles?: Array<[number, number, number, number, number, number]> }; candles?: Array<[number, number, number, number, number, number]> };

    const raw = res?.payload?.candles ?? res?.candles ?? [];
    return raw.map(([ts, open, high, low, close, volume]) => ({
      timestamp: new Date(ts * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume,
    }));
  }

  async getQuote(symbols: string[]): Promise<Record<string, BrokerQuote>> {
    const out: Record<string, BrokerQuote> = {};
    const to = new Date();
    const from = new Date(to.getTime() - 15 * 60_000);
    for (const sym of symbols) {
      const candles = await this.getHistoricalCandles({
        symbol: sym,
        interval: '1m',
        fromDate: from.toISOString(),
        toDate: to.toISOString(),
      });
      const last = candles[candles.length - 1];
      out[sym] = {
        symbol: sym,
        ltp: last?.close ?? 0,
        open: last?.open ?? 0,
        high: last?.high ?? 0,
        low: last?.low ?? 0,
        close: last?.close ?? 0,
        volume: last?.volume ?? 0,
        timestamp: last?.timestamp ?? to.toISOString(),
      };
    }
    return out;
  }

  async placeOrder(order: BrokerOrderRequest): Promise<BrokerOrderResult> {
    const res = (await this.client.placeOrder({
      symbol: order.symbol,
      exchange: 'NSE',
      side: order.side,
      quantity: order.quantity,
      orderType: order.orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
      price: order.price,
      triggerPrice: order.triggerPrice,
      product: order.product === 'DELIVERY' ? 'NRML' : 'MIS',
      validity: 'DAY',
    })) as { order_id?: string; groww_order_id?: string; status?: string };

    const orderId = res?.groww_order_id ?? res?.order_id ?? '';
    return {
      orderId,
      status: orderId ? 'PENDING' : 'REJECTED',
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    await this.client.cancelOrder(orderId);
    return true;
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const res = await this.client.getPositions();
    const list = res?.data ?? [];
    return list.map((p) => ({
      symbol: String(p['trading_symbol'] ?? p['symbol'] ?? ''),
      quantity: Number(p['quantity'] ?? 0),
      avgPrice: Number(p['average_price'] ?? 0),
      ltp: Number(p['ltp'] ?? p['last_price'] ?? 0),
      pnl: Number(p['pnl'] ?? 0),
    }));
  }

  async getMargins(): Promise<BrokerMarginInfo> {
    const res = (await this.client.getMarginDetails()) as {
      payload?: { available_margin?: number; utilized_margin?: number };
    };
    return {
      availableMargin: Number(res?.payload?.available_margin ?? 0),
      usedMargin: Number(res?.payload?.utilized_margin ?? 0),
    };
  }

  async getOrderBook(): Promise<Array<{
    orderId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    status: 'OPEN' | 'PARTIAL' | 'COMPLETE' | 'REJECTED' | 'CANCELLED';
    quantity: number;
    filledQuantity: number;
    avgPrice: number;
    price: number;
    placedAt?: string;
  }>> {
    try {
      const raw = (await this.client.getOrderHistory()) as any;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.orders)
            ? raw.orders
            : [];

      return list.map((o: any) => {
        const rawStatus = String(o.order_status || o.status || '').toUpperCase();
        let status: 'OPEN' | 'PARTIAL' | 'COMPLETE' | 'REJECTED' | 'CANCELLED' = 'OPEN';
        if (rawStatus === 'COMPLETE' || rawStatus === 'FILLED' || rawStatus === 'EXECUTED') status = 'COMPLETE';
        else if (rawStatus === 'CANCELLED' || rawStatus === 'CANCELED') status = 'CANCELLED';
        else if (rawStatus === 'REJECTED') status = 'REJECTED';
        else if (Number(o.filled_quantity ?? 0) > 0 && Number(o.filled_quantity ?? 0) < Number(o.quantity ?? 0)) status = 'PARTIAL';

        return {
          orderId: String(o.groww_order_id || o.order_id || o.id || ''),
          symbol: String(o.symbol || o.trading_symbol || ''),
          side: String(o.side || o.transaction_type || '').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
          status,
          quantity: Number(o.quantity ?? 0),
          filledQuantity: Number(o.filled_quantity ?? o.cumulative_quantity ?? 0),
          avgPrice: Number(o.avg_execution_price ?? o.average_price ?? o.price ?? 0),
          price: Number(o.price ?? 0),
          placedAt: o.order_time || o.created_at,
        };
      });
    } catch {
      return [];
    }
  }
}

export interface BrokerRouter {
  dataBroker: BrokerAdapter;
  executionBroker: BrokerAdapter;
  activeDataBrokerName: BrokerName;
  activeExecutionBrokerName: BrokerName;
}

export function createBrokerRouter(growwClient: GrowwClient): BrokerRouter {
  const dataName: BrokerName = process.env['ACTIVE_DATA_BROKER'] === 'upstox' ? 'upstox' : 'groww';
  const execName: BrokerName = process.env['ACTIVE_EXECUTION_BROKER'] === 'upstox' ? 'upstox' : 'groww';

  const growwAdapter = new GrowwBrokerAdapter(growwClient);
  const upstoxAdapter = new UpstoxClient();

  return {
    dataBroker: dataName === 'upstox' ? upstoxAdapter : growwAdapter,
    executionBroker: execName === 'upstox' ? upstoxAdapter : growwAdapter,
    activeDataBrokerName: dataName,
    activeExecutionBrokerName: execName,
  };
}
