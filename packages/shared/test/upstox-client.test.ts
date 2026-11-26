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
});
