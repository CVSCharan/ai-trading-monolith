// ============================================
// Unified Broker Adapter Types (Groww + Upstox)
// ============================================

export type BrokerName = 'groww' | 'upstox';

export interface BrokerCandle {
  timestamp: string; // ISO-8601
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

export interface BrokerQuote {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
  timestamp: string;
}

export interface OptionChainRow {
  strikePrice: number;
  expiryDate: string;
  call?: {
    instrumentKey: string;
    ltp: number;
    oi: number;
    volume: number;
    iv?: number;
    delta?: number;
  };
  put?: {
    instrumentKey: string;
    ltp: number;
    oi: number;
    volume: number;
    iv?: number;
    delta?: number;
  };
}

export interface BrokerOrderRequest {
  symbol: string;
  instrumentKey?: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  product?: 'INTRADAY' | 'DELIVERY';
  price?: number;
  triggerPrice?: number;
  tag?: string;
}

export interface BrokerOrderResult {
  orderId: string;
  status: 'PENDING' | 'OPEN' | 'COMPLETE' | 'REJECTED';
  message?: string;
}

export interface BrokerPosition {
  symbol: string;
  quantity: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
}

export interface BrokerMarginInfo {
  availableMargin: number;
  usedMargin: number;
}

export interface BrokerAdapter {
  readonly name: BrokerName;
  getHistoricalCandles(params: {
    symbol: string;
    interval: '1m' | '5m' | '15m' | '30m' | '1d';
    fromDate: string;
    toDate: string;
  }): Promise<BrokerCandle[]>;
  getQuote(symbols: string[]): Promise<Record<string, BrokerQuote>>;
  getOptionChain?(params: { instrumentKey: string; expiryDate: string }): Promise<OptionChainRow[]>;
  placeOrder(order: BrokerOrderRequest): Promise<BrokerOrderResult>;
  cancelOrder(orderId: string): Promise<boolean>;
  getPositions(): Promise<BrokerPosition[]>;
  getMargins(): Promise<BrokerMarginInfo>;
}
