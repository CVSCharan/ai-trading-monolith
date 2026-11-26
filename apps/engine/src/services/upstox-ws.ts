// ============================================
// Upstox Market Data WebSocket v3 (S11-002)
// Uses UPSTOX_ANALYTICS_TOKEN (no Static IP needed)
// ============================================

import pino from 'pino';

export interface UpstoxFeedTick {
  instrumentKey: string;
  ltp: number;
  timestamp: string;
}

export class UpstoxMarketDataFeed {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private logger: pino.Logger;

  constructor(
    logger: pino.Logger,
    private readonly onTick?: (tick: UpstoxFeedTick) => void,
    private readonly analyticsToken = process.env['UPSTOX_ANALYTICS_TOKEN'],
  ) {
    this.logger = logger.child({ component: 'UpstoxMarketDataFeed' });
  }

  async connect(instrumentKeys: string[] = ['NSE_INDEX|Nifty 50', 'NSE_INDEX|Nifty Bank']): Promise<void> {
    if (!this.analyticsToken) {
      this.logger.info('UPSTOX_ANALYTICS_TOKEN not set; skipping Upstox WS connect');
      return;
    }

    this.stopped = false;
    try {
      const authRes = await fetch('https://api.upstox.com/v3/feed/market-data-feed/authorize', {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.analyticsToken}`,
        },
      });

      if (!authRes.ok) {
        throw new Error(`Upstox WS authorize failed (${authRes.status})`);
      }

      const authJson = (await authRes.json()) as { data?: { authorized_redirect_uri?: string } };
      const wsUrl = authJson?.data?.authorized_redirect_uri;
      if (!wsUrl) {
        throw new Error('Upstox WS authorize did not return authorized_redirect_uri');
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.logger.info({ instruments: instrumentKeys }, 'Upstox Market Data WS connected');
        const subPayload = {
          guid: crypto.randomUUID(),
          method: 'sub',
          data: {
            mode: 'ltpc',
            instrumentKeys,
          },
        };
        this.ws?.send(Buffer.from(JSON.stringify(subPayload)));
      };

      this.ws.onmessage = (event) => {
        try {
          const text = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
          if (!text.startsWith('{')) return; // binary protobuf frame when not JSON
          const msg = JSON.parse(text) as { feeds?: Record<string, { ltpc?: { ltp?: number; ltt?: string } }> };
          if (!msg.feeds) return;
          for (const [instrumentKey, feed] of Object.entries(msg.feeds)) {
            if (feed.ltpc?.ltp !== undefined) {
              this.onTick?.({
                instrumentKey,
                ltp: feed.ltpc.ltp,
                timestamp: feed.ltpc.ltt ?? new Date().toISOString(),
              });
            }
          }
        } catch {
          // ignore non-JSON frames
        }
      };

      this.ws.onerror = (err) => {
        this.logger.warn({ err }, 'Upstox WS error');
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.stopped) {
          this.logger.warn('Upstox WS closed; scheduling reconnect in 5s');
          this.reconnectTimer = setTimeout(() => void this.connect(instrumentKeys), 5_000);
        }
      };
    } catch (err) {
      this.logger.error({ err }, 'Failed to initialize Upstox WS');
    }
  }

  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
