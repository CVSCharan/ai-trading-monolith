import { describe, expect, test, mock } from 'bun:test';
import { UpstoxClient } from '../src/upstox-client';

describe('UpstoxClient (S10-003)', () => {
  test('throws when neither analyticsToken nor accessToken is set', async () => {
    const client = new UpstoxClient({ analyticsToken: '', accessToken: '' });
    await expect(
      client.getHistoricalCandles({
        symbol: 'NSE_INDEX|Nifty 50',
        interval: '15m',
        fromDate: '2026-11-01',
        toDate: '2026-11-05',
      }),
    ).rejects.toThrow('Upstox token not configured');
  });

  test('throws on placeOrder when only analyticsToken is provided (read-only)', async () => {
    const client = new UpstoxClient({ analyticsToken: 'dummy-analytics-token', accessToken: '' });
    await expect(
      client.placeOrder({
        symbol: 'NIFTY24NOV24000CE',
        side: 'BUY',
        quantity: 75,
        orderType: 'MARKET',
      }),
    ).rejects.toThrow('UPSTOX_ACCESS_TOKEN is required');
  });

  test('maps historical candles and option chain from Upstox API', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: string) => {
      if (url.includes('/v2/historical-candle/')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: { candles: [['2026-11-01T09:15:00+05:30', 24100, 24150, 24080, 24120, 1200, 5000]] },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          status: 'success',
          data: [
            {
              strike_price: 24100,
              expiry: '2026-11-28',
              call_options: {
                instrument_key: 'NSE_FO|12345',
                market_data: { ltp: 145.5, oi: 250000, volume: 12000 },
                option_greeks: { iv: 14.2, delta: 0.52 },
              },
              put_options: {
                instrument_key: 'NSE_FO|12346',
                market_data: { ltp: 120.0, oi: 310000, volume: 14000 },
                option_greeks: { iv: 15.1, delta: -0.48 },
              },
            },
          ],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    try {
      const client = new UpstoxClient({ analyticsToken: 'dummy-analytics-token' });
      const candles = await client.getHistoricalCandles({
        symbol: 'NSE_INDEX|Nifty 50',
        interval: '15m',
        fromDate: '2026-11-01',
        toDate: '2026-11-05',
      });
      expect(candles).toHaveLength(1);
      expect(candles[0]?.close).toBe(24120);

      const chain = await client.getOptionChain({
        instrumentKey: 'NSE_INDEX|Nifty 50',
        expiryDate: '2026-11-28',
      });
      expect(chain).toHaveLength(1);
      expect(chain[0]?.strikePrice).toBe(24100);
      expect(chain[0]?.call?.oi).toBe(250000);
      expect(chain[0]?.put?.delta).toBe(-0.48);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('supports getQuote, getRegisteredStaticIps, placeOrder, cancelOrder, getPositions, getMargins, and error handling', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: string) => {
      if (url.includes('/v2/market-quote/quotes')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: {
              'NSE_INDEX|Nifty 50': {
                last_price: 24250,
                ohlc: { open: 24100, high: 24300, low: 24050, close: 24200 },
                volume: 50000,
                oi: 1000,
              },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes('/user/ip')) {
        return new Response(
          JSON.stringify({ status: 'success', data: { primary_ip: '1.2.3.4', secondary_ip: '5.6.7.8' } }),
          { status: 200 },
        );
      }
      if (url.includes('/v3/order/place')) {
        return new Response(JSON.stringify({ status: 'success', data: { order_id: 'UPX-999' } }), { status: 200 });
      }
      if (url.includes('/v2/order/cancel')) {
        return new Response(JSON.stringify({ status: 'success', data: {} }), { status: 200 });
      }
      if (url.includes('/v2/portfolio/short-term-positions')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: [{ tradingsymbol: 'NIFTY24NOV24000CE', quantity: 75, average_price: 120, last_price: 145, pnl: 1875 }],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/v2/user/get-funds-and-margin')) {
        return new Response(
          JSON.stringify({ status: 'success', data: { equity: { available_margin: 250000, used_margin: 45000 } } }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ status: 'error', errors: [{ message: 'Bad request' }] }), { status: 400 });
    }) as unknown as typeof fetch;

    try {
      const client = new UpstoxClient({
        analyticsToken: 'analytics-tok',
        accessToken: 'trade-tok',
        algoName: 'AI_TRADER_9_21',
      });

      const quotes = await client.getQuote(['NSE_INDEX|Nifty 50']);
      expect(quotes['NSE_INDEX|Nifty 50']?.ltp).toBe(24250);

      const ips = await client.getRegisteredStaticIps();
      expect(ips.primaryIp).toBe('1.2.3.4');

      const orderRes = await client.placeOrder({
        symbol: 'NIFTY24NOV24000CE',
        side: 'BUY',
        quantity: 75,
        orderType: 'MARKET',
      });
      expect(orderRes.orderId).toBe('UPX-999');
      expect(orderRes.status).toBe('PENDING');

      expect(await client.cancelOrder('UPX-999')).toBe(true);

      const positions = await client.getPositions();
      expect(positions[0]?.pnl).toBe(1875);

      const margins = await client.getMargins();
      expect(margins.availableMargin).toBe(250000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
