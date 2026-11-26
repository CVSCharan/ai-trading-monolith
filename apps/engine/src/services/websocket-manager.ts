// ============================================
// WebSocket Manager for Groww Market Data
// ============================================

import WebSocket from 'ws';
import pino from 'pino';
import { config } from '../config';
import { getAlignedBarTimeIST, isMarketHours, getISTDateString } from '@groww-trading/shared';

interface Subscription {
  symbols: string[];
  timeframe: string;
  callbacks: Set<(data: any) => void>;
}

interface TickData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
  oi?: number;
}

interface CandleData {
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
  timestamp: Date;
}

export class WebSocketManager {
  private logger: pino.Logger;
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 60_000;
  private isConnecting = false;
  private isManualClose = false;
  private messageBuffer: any[] = [];
  private lastPing = Date.now();
  private lastReceivedBarTime: Date | null = null;
  private tokenProvider: (() => Promise<string>) | null = null;
  private onBackfillNeeded: ((from: Date, to: Date) => Promise<void>) | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ component: 'WebSocketManager' });
  }

  async connect(
    tokenOrProvider: string | (() => Promise<string>),
    onBackfill?: (from: Date, to: Date) => Promise<void>
  ): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isManualClose = false;
    this.tokenProvider =
      typeof tokenOrProvider === 'function' ? tokenOrProvider : async () => tokenOrProvider;
    if (onBackfill) this.onBackfillNeeded = onBackfill;

    this.isConnecting = true;

    try {
      const token = await this.tokenProvider();
      const wsUrl = `${config.groww.apiBaseUrl.replace('http', 'ws')}/v1/market/ws?token=${token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => void this.handleOpen());
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', () => this.handleClose());
      this.ws.on('error', (err) => this.handleError(err));
      this.ws.on('pong', () => { this.lastPing = Date.now(); });

      if (!this.pingTimer) {
        this.pingTimer = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.ping();
          }
        }, 30_000);
      }
    } catch (error) {
      this.isConnecting = false;
      this.logger.error({ err: error }, 'Failed to create WebSocket connection');
      throw error;
    }
  }

  private async handleOpen() {
    this.logger.info('WebSocket connected to Groww');
    const wasReconnect = this.reconnectAttempts > 0;
    this.isConnecting = false;
    this.reconnectAttempts = 0;

    if (wasReconnect && this.lastReceivedBarTime && this.onBackfillNeeded) {
      const from = this.lastReceivedBarTime;
      const to = new Date();
      this.logger.info({ from, to }, 'Backfilling missing bars after WebSocket reconnect');
      try {
        await this.onBackfillNeeded(from, to);
      } catch (err) {
        this.logger.error({ err }, 'Backfill after reconnect failed');
      }
    }

    for (const [, sub] of this.subscriptions) {
      this.sendSubscribe(sub.symbols, sub.timeframe);
    }

    while (this.messageBuffer.length > 0) {
      const msg = this.messageBuffer.shift();
      this.send(msg);
    }
  }

  private handleMessage(data: WebSocket.Data) {
    try {
      const message = JSON.parse(data.toString());
      this.processMessage(message);
    } catch (error) {
      this.logger.warn({ err: error, data: data.toString() }, 'Failed to parse WebSocket message');
    }
  }

  private processMessage(message: any) {
    // Groww WebSocket message format (hypothetical - adjust to actual)
    if (message.type === 'tick') {
      const tick: TickData = {
        symbol: message.symbol,
        price: message.ltp,
        volume: message.volume,
        timestamp: new Date(message.timestamp),
        oi: message.oi,
      };
      this.broadcast('tick', tick);

      // Also build 1m candles
      this.updateCandle(tick);
    } else if (message.type === 'candle') {
      const candle: CandleData = {
        symbol: message.symbol,
        timeframe: message.timeframe,
        open: message.o,
        high: message.h,
        low: message.l,
        close: message.c,
        volume: message.v,
        oi: message.oi,
        timestamp: new Date(message.t),
      };
      this.broadcast(`candle:${message.symbol}:${message.timeframe}`, candle);
    } else if (message.type === 'subscribe_ack') {
      this.logger.debug({ symbols: message.symbols }, 'Subscription acknowledged');
    }
  }

  private candleBuffers: Map<string, { open: number; high: number; low: number; close: number; volume: number; oi?: number; startTime: Date }> = new Map();

  private updateCandle(tick: TickData) {
    const key = `${tick.symbol}:1m`;
    const barTime = getAlignedBarTimeIST(tick.timestamp, 1);

    let buffer = this.candleBuffers.get(key);
    if (!buffer || buffer.startTime.getTime() !== barTime.getTime()) {
      // Emit previous completed candle
      if (buffer) {
        this.emitCandle(tick.symbol, '1m', buffer);
      }

      // Start new candle
      buffer = {
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume,
        oi: tick.oi,
        startTime: barTime,
      };
      this.candleBuffers.set(key, buffer);
    } else {
      // Update existing candle
      buffer.high = Math.max(buffer.high, tick.price);
      buffer.low = Math.min(buffer.low, tick.price);
      buffer.close = tick.price;
      buffer.volume += tick.volume;
      buffer.oi = tick.oi ?? buffer.oi;
    }
  }

  private emitCandle(symbol: string, timeframe: string, buffer: any) {
    this.lastReceivedBarTime = buffer.startTime instanceof Date ? buffer.startTime : new Date();
    const candle: CandleData = {
      symbol,
      timeframe,
      open: buffer.open,
      high: buffer.high,
      low: buffer.low,
      close: buffer.close,
      volume: buffer.volume,
      oi: buffer.oi,
      timestamp: buffer.startTime,
    };
    this.broadcast(`candle:${symbol}:${timeframe}`, candle);
  }

  broadcast(event: string, data: any) {
    for (const [key, sub] of this.subscriptions) {
      if (sub.symbols.includes(data.symbol) || sub.symbols.includes('*')) {
        for (const callback of sub.callbacks) {
          try {
            callback({ type: event, payload: data });
          } catch (error) {
            this.logger.error({ err: error, event }, 'Callback error');
          }
        }
      }
    }
  }

  private handleClose() {
    this.logger.warn('WebSocket disconnected');
    this.isConnecting = false;
    if (!this.isManualClose) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Error) {
    this.logger.error({ err: error }, 'WebSocket error');
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.maxReconnectDelay,
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    );
    this.logger.info({ attempt: this.reconnectAttempts, delay }, 'Scheduling reconnect');

    setTimeout(() => {
      if (this.isManualClose || !this.tokenProvider) return;
      this.connect(this.tokenProvider).catch((err) => {
        this.logger.error({ err }, 'Reconnect attempt failed');
        this.scheduleReconnect();
      });
    }, delay);
  }

  subscribe(symbols: string[], timeframe: string, callback: (data: any) => void): () => void {
    const key = `${symbols.sort().join(',')}:${timeframe}`;
    let sub = this.subscriptions.get(key);

    if (!sub) {
      sub = { symbols, timeframe, callbacks: new Set() };
      this.subscriptions.set(key, sub);
      this.sendSubscribe(symbols, timeframe);
    }

    sub.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      sub!.callbacks.delete(callback);
      if (sub!.callbacks.size === 0) {
        this.subscriptions.delete(key);
        this.sendUnsubscribe(symbols, timeframe);
      }
    };
  }

  private sendSubscribe(symbols: string[], timeframe: string) {
    this.send({
      type: 'subscribe',
      payload: { symbols, timeframe },
    });
  }

  private sendUnsubscribe(symbols: string[], timeframe: string) {
    this.send({
      type: 'unsubscribe',
      payload: { symbols, timeframe },
    });
  }

  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageBuffer.push(message);
    }
  }

  getConnectionCount(): number {
    return this.subscriptions.size;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async disconnect(): Promise<void> {
    this.isManualClose = true;
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.messageBuffer = [];
  }
}