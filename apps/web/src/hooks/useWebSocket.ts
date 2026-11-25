import { useEffect, useRef, useState } from 'react';

export interface WsEvent {
  channel: string;
  data: unknown;
  timestamp: string;
}

export function useWebSocket(channels: string[]) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<WsEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const channelsKey = channels.join(',');

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = 1000;

    function connect() {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/api/market/ws`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        delay = 1000;
        if (channels.length > 0) {
          ws.send(JSON.stringify({ action: 'subscribe', channels }));
        }
      };

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(String(evt.data)) as WsEvent;
          if (parsed.channel) {
            setEvents((prev) => [parsed, ...prev].slice(0, 50));
          }
        } catch {
          // Ignore non-event ack frames
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          reconnectTimer = setTimeout(() => {
            delay = Math.min(30_000, delay * 2);
            connect();
          }, delay);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [channelsKey]);

  return { connected, events, lastEvent: events[0] ?? null };
}
