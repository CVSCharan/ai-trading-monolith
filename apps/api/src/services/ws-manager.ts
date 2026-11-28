import { Elysia } from 'elysia';
import { z } from 'zod';
import { auth } from '../auth';
import { pgClient } from '../db';
import { logger } from '../logger';

const VALID_CHANNELS = new Set([
  'ticks',
  'candles',
  'signals',
  'paper_updates',
  'live_updates',
]);

const PRIVATE_CHANNELS = new Set(['paper_updates', 'live_updates']);

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
  private clientUsers = new Map<SubscribableSocket, string>();
  private listening = false;

  registerClient(ws: SubscribableSocket, userId: string): void {
    this.clientUsers.set(ws, userId);
  }

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
    this.clientUsers.delete(ws);
  }

  broadcast(channel: string, payload: unknown, targetUserId?: string): void {
    const subscribers = this.channels.get(channel);
    if (!subscribers || subscribers.size === 0) return;

    const isPrivate = PRIVATE_CHANNELS.has(channel);
    const resolvedUserId =
      targetUserId ??
      (payload && typeof payload === 'object' && 'userId' in payload && typeof (payload as { userId?: unknown }).userId === 'string'
        ? (payload as { userId: string }).userId
        : undefined);

    if (isPrivate && !resolvedUserId) {
      logger.warn({ channel }, 'Dropped private WS broadcast without userId');
      return;
    }

    const message = JSON.stringify({ channel, data: payload, timestamp: new Date().toISOString() });
    for (const ws of subscribers) {
      if (isPrivate && this.clientUsers.get(ws) !== resolvedUserId) {
        continue;
      }
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
          const parsed = JSON.parse(rawPayload) as { channel?: string; data?: unknown; userId?: string };
          if (parsed.channel && VALID_CHANNELS.has(parsed.channel)) {
            this.broadcast(parsed.channel, parsed.data, parsed.userId);
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
  async beforeHandle({ request, set }) {
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user?.id) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
    } catch {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
  },
  async open(ws) {
    try {
      const req = (ws.data as { request?: Request } | undefined)?.request;
      const session = req ? await auth.api.getSession({ headers: req.headers }) : null;
      if (!session?.user?.id) {
        ws.close(4001, 'Unauthorized');
        return;
      }
      wsManager.registerClient(ws, session.user.id);
      logger.debug({ id: ws.id, userId: session.user.id }, 'WebSocket client connected');
    } catch {
      ws.close(4001, 'Unauthorized');
    }
  },
  message(ws, message) {
    let raw: unknown;
    try {
      raw = typeof message === 'string' ? JSON.parse(message) : message;
    } catch {
      ws.send(JSON.stringify({ error: 'Invalid JSON message' }));
      return;
    }

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
