// ============================================
// Upstox Client (Analytics Token + API v3 Trading)
// - Analytics Token (1-year read-only): Market Data, Historical Candles, Option Chain (no Static IP needed)
// - Access Token + Static IP + X-Algo-Name: Account P&L & API v3 Order Placement
// ============================================

import type {
  BrokerAdapter,
  BrokerCandle,
  BrokerMarginInfo,
  BrokerOrderRequest,
  BrokerOrderResult,
  BrokerPosition,
  BrokerQuote,
  OptionChainRow,
} from './broker';

export interface UpstoxClientConfig {
  analyticsToken?: string;
  accessToken?: string;
  algoName?: string;
  baseUrl?: string;
}

const DEFAULT_UPSTOX_BASE_URL = 'https://api.upstox.com';

const INTERVAL_MAP: Record<string, string> = {
  '1m': '1minute',
  '5m': '5minute',
  '15m': '15minute',
  '30m': '30minute',
  '1d': 'day',
};

export class UpstoxClient implements BrokerAdapter {
  readonly name = 'upstox' as const;
  private readonly analyticsToken?: string;
  private readonly accessToken?: string;
  private readonly algoName?: string;
  private readonly baseUrl: string;

  constructor(cfg: UpstoxClientConfig = {}) {
    this.analyticsToken = cfg.analyticsToken ?? process.env['UPSTOX_ANALYTICS_TOKEN'];
    this.accessToken = cfg.accessToken ?? process.env['UPSTOX_ACCESS_TOKEN'];
    this.algoName = cfg.algoName ?? process.env['UPSTOX_ALGO_NAME'];
    this.baseUrl = cfg.baseUrl ?? DEFAULT_UPSTOX_BASE_URL;
  }

  private getReadToken(): string {
    const token = this.analyticsToken || this.accessToken;
    if (!token) {
      throw new Error('Upstox token not configured. Set UPSTOX_ANALYTICS_TOKEN or UPSTOX_ACCESS_TOKEN in .env');
    }
    return token;
  }

  private getTradeToken(): string {
    if (!this.accessToken) {
      throw new Error(
        'UPSTOX_ACCESS_TOKEN is required for order execution. Analytics Token is read-only.',
      );
    }
    return this.accessToken;
  }

  private async request<T>(
    path: string,
    opts: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      token: string;
      body?: unknown;
      extraHeaders?: Record<string, string>;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${opts.token}`,
      ...opts.extraHeaders,
    };
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    const json = (await res.json()) as { status?: string; data?: T; errors?: Array<{ message?: string }> };
    if (!res.ok || json.status === 'error') {
      const msg = json.errors?.[0]?.message ?? `Upstox API error (${res.status})`;
      throw new Error(msg);
    }
    return json.data as T;
  }

  async getHistoricalCandles(params: {
    symbol: string;
    interval: '1m' | '5m' | '15m' | '30m' | '1d';
    fromDate: string;
    toDate: string;
  }): Promise<BrokerCandle[]> {
    const interval = INTERVAL_MAP[params.interval] ?? '15minute';
    const encodedKey = encodeURIComponent(params.symbol);
    const data = await this.request<{ candles: Array<[string, number, number, number, number, number, number?]> }>(
      `/v2/historical-candle/${encodedKey}/${interval}/${params.toDate}/${params.fromDate}`,
      { token: this.getReadToken() },
    );

    return (data?.candles ?? []).map(([timestamp, open, high, low, close, volume, oi]) => ({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      oi,
    }));
  }

  async getQuote(symbols: string[]): Promise<Record<string, BrokerQuote>> {
    const joined = encodeURIComponent(symbols.join(','));
    const data = await this.request<Record<string, {
      last_price: number;
      ohlc?: { open: number; high: number; low: number; close: number };
      volume?: number;
      oi?: number;
      timestamp?: string;
    }>>(`/v2/market-quote/quotes?instrument_key=${joined}`, {
      token: this.getReadToken(),
    });

    const out: Record<string, BrokerQuote> = {};
    for (const [key, q] of Object.entries(data ?? {})) {
      out[key] = {
        symbol: key,
        ltp: q.last_price,
        open: q.ohlc?.open ?? q.last_price,
        high: q.ohlc?.high ?? q.last_price,
        low: q.ohlc?.low ?? q.last_price,
        close: q.ohlc?.close ?? q.last_price,
        volume: q.volume ?? 0,
        oi: q.oi,
        timestamp: q.timestamp ?? new Date().toISOString(),
      };
    }
    return out;
  }

  async getOptionChain(params: { instrumentKey: string; expiryDate: string }): Promise<OptionChainRow[]> {
    const qs = new URLSearchParams({
      instrument_key: params.instrumentKey,
      expiry_date: params.expiryDate,
    });
    const data = await this.request<Array<{
      strike_price: number;
      expiry: string;
      call_options?: {
        instrument_key: string;
        market_data?: { ltp: number; oi: number; volume: number };
        option_greeks?: { iv?: number; delta?: number };
      };
      put_options?: {
        instrument_key: string;
        market_data?: { ltp: number; oi: number; volume: number };
        option_greeks?: { iv?: number; delta?: number };
      };
    }>>(`/v2/option/chain?${qs.toString()}`, {
      token: this.getReadToken(),
    });

    return (data ?? []).map((row) => ({
      strikePrice: row.strike_price,
      expiryDate: row.expiry,
      call: row.call_options
        ? {
            instrumentKey: row.call_options.instrument_key,
            ltp: row.call_options.market_data?.ltp ?? 0,
            oi: row.call_options.market_data?.oi ?? 0,
            volume: row.call_options.market_data?.volume ?? 0,
            iv: row.call_options.option_greeks?.iv,
            delta: row.call_options.option_greeks?.delta,
          }
        : undefined,
      put: row.put_options
        ? {
            instrumentKey: row.put_options.instrument_key,
            ltp: row.put_options.market_data?.ltp ?? 0,
            oi: row.put_options.market_data?.oi ?? 0,
            volume: row.put_options.market_data?.volume ?? 0,
            iv: row.put_options.option_greeks?.iv,
            delta: row.put_options.option_greeks?.delta,
          }
        : undefined,
    }));
  }

  async getRegisteredStaticIps(): Promise<{ primaryIp?: string; secondaryIp?: string }> {
    const data = await this.request<{ primary_ip?: string; secondary_ip?: string }>('/user/ip', {
      token: this.getReadToken(),
    });
    return {
      primaryIp: data?.primary_ip,
      secondaryIp: data?.secondary_ip,
    };
  }

  async placeOrder(order: BrokerOrderRequest): Promise<BrokerOrderResult> {
    const extraHeaders: Record<string, string> = {};
    if (this.algoName) {
      extraHeaders['X-Algo-Name'] = this.algoName;
    }

    const data = await this.request<{ order_id?: string; order_ids?: string[] }>('/v3/order/place', {
      method: 'POST',
      token: this.getTradeToken(),
      extraHeaders,
      body: {
        quantity: order.quantity,
        product: order.product === 'DELIVERY' ? 'D' : 'I',
        validity: 'DAY',
        price: order.price ?? 0,
        tag: order.tag ?? 'ai_trader',
        instrument_token: order.instrumentKey ?? order.symbol,
        order_type: order.orderType,
        transaction_type: order.side,
        disclosed_quantity: 0,
        trigger_price: order.triggerPrice ?? 0,
        is_amo: false,
      },
    });

    const orderId = data?.order_id ?? data?.order_ids?.[0] ?? '';
    return {
      orderId,
      status: orderId ? 'PENDING' : 'REJECTED',
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    await this.request(`/v2/order/cancel?order_id=${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
      token: this.getTradeToken(),
    });
    return true;
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const data = await this.request<Array<{
      tradingsymbol: string;
      quantity: number;
      average_price: number;
      last_price: number;
      pnl: number;
    }>>('/v2/portfolio/short-term-positions', {
      token: this.getReadToken(),
    });

    return (data ?? []).map((p) => ({
      symbol: p.tradingsymbol,
      quantity: p.quantity,
      avgPrice: p.average_price,
      ltp: p.last_price,
      pnl: p.pnl,
    }));
  }

  async getMargins(): Promise<BrokerMarginInfo> {
    const data = await this.request<{ equity?: { available_margin?: number; used_margin?: number } }>(
      '/v2/user/get-funds-and-margin',
      { token: this.getReadToken() },
    );
    return {
      availableMargin: data?.equity?.available_margin ?? 0,
      usedMargin: data?.equity?.used_margin ?? 0,
    };
  }
}
