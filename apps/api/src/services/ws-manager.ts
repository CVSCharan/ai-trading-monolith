import { Elysia } from 'elysia';
import { z } from 'zod';
import { pgClient } from '../db';
import { logger } from '../logger';

const VALID_CHANNELS = new Set([
  'ticks',
  'candles',
  'signals',
  'paper_updates',
  'live_updates',
]);

const ClientMessageSchema = z.object({
  action: z.enum(['subscribe', 'unsubscribe']),
  channels: z.array(z.string()).min(1),
});

interface SubscribableSocket {
  send(data: string): void;
}

class WebSocketManager {
  private channels = new Map<string, Set<SubscribableSocket>>();
  private clientChannels = new Map<SubscribableSocket, Set<string>>();
  private listening = false;

  subscribe(ws: SubscribableSocket, channel: string): void {
    if (!VALID_CHANNELS.has(channel)) return;
    if (!this.channels.has(channel)) this.channels.set(channel, new Set());
    this.channels.get(channel)!.add(ws);

    if (!this.clientChannels.has(ws)) this.clientChannels.set(ws, new Set());
    this.clientChannels.get(ws)!.add(channel);
  }

  unsubscribe(ws: SubscribableSocket, channel: string): void {
    this.channels.get(channel)?.delete(ws);
    this.clientChannels.get(ws)?.delete(channel);
  }

  removeClient(ws: SubscribableSocket): void {
    const subscribed = this.clientChannels.get(ws);
    if (subscribed) {
      for (const ch of subscribed) {
        this.channels.get(ch)?.delete(ws);
      }
      this.clientChannels.delete(ws);
    }
  }

  broadcast(channel: string, payload: unknown): void {
    const subscribers = this.channels.get(channel);
    if (!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify({ channel, data: payload, timestamp: new Date().toISOString() });
    for (const ws of subscribers) {
      try {
        ws.send(message);
      } catch (err) {
        logger.warn({ err, channel }, 'Failed to send WS message, removing client');
        this.removeClient(ws);
      }
    }
  }

  async startPostgresBridge(): Promise<void> {
    if (this.listening) return;
    this.listening = true;
    try {
      await pgClient.listen('trading_events', (rawPayload) => {
        try {
          const parsed = JSON.parse(rawPayload) as { channel?: string; data?: unknown };
          if (parsed.channel && VALID_CHANNELS.has(parsed.channel)) {
            this.broadcast(parsed.channel, parsed.data);
          }
        } catch (err) {
          logger.warn({ err }, 'Invalid trading_events payload');
        }
      });
      logger.info('WebSocket Postgres LISTEN bridge started');
    } catch (err) {
      this.listening = false;
      logger.error({ err }, 'Failed to start WebSocket Postgres LISTEN bridge');
    }
  }
}

export const wsManager = new WebSocketManager();

export const wsPlugin = new Elysia({ name: 'ws-plugin' }).ws('/api/market/ws', {
  open(ws) {
    logger.debug({ id: ws.id }, 'WebSocket client connected');
  },
  message(ws, message) {
    const raw = typeof message === 'string' ? JSON.parse(message) : message;
    const parsed = ClientMessageSchema.safeParse(raw);
    if (!parsed.success) {
      ws.send(JSON.stringify({ error: 'Invalid subscription message' }));
      return;
    }

    for (const ch of parsed.data.channels) {
      if (parsed.data.action === 'subscribe') {
        wsManager.subscribe(ws, ch);
      } else {
        wsManager.unsubscribe(ws, ch);
      }
    }
    ws.send(JSON.stringify({ ok: true, action: parsed.data.action, channels: parsed.data.channels }));
  },
  close(ws) {
    wsManager.removeClient(ws);
  },
});
