import { Elysia, t } from 'elysia';
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { UpstoxClient, getMarketStatuses } from '@groww-trading/shared';
import { config } from '../config';
import { db } from '../db';
import { candles1m, candlesResampled, instruments } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';

export const marketDataRoutes = new Elysia({ prefix: '/api/market' })
  .use(authPlugin)
  .get('/sessions', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const now = new Date();
    const sessions = getMarketStatuses(now);
    return {
      sessions,
      timestamp: now.toISOString(),
      serverTimeIST: now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    };
  })
  .get('/instruments', async ({ query, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const symbol = query['symbol'];
    const rows = await db
      .select()
      .from(instruments)
      .where(
        symbol
          ? and(eq(instruments.symbol, symbol), eq(instruments.isActive, true))
          : eq(instruments.isActive, true)
      )
      .orderBy(asc(instruments.symbol));

    return { instruments: rows };
  })
  .get('/candles/:symbol', async ({ params, query, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const timeframe = (query['timeframe'] ?? '1m') as '1m' | '5m' | '15m' | '30m';
    const limit = Math.min(1000, Math.max(1, Number(query['limit'] ?? '200')));

    const [inst] = await db
      .select({ id: instruments.id })
      .from(instruments)
      .where(and(eq(instruments.symbol, params.symbol), eq(instruments.isActive, true)))
      .limit(1);

    if (!inst) {
      set.status = 404;
      return { error: `Instrument not found: ${params.symbol}` };
    }

    const fromDate = query['from'] ? new Date(query['from']) : undefined;
    const toDate = query['to'] ? new Date(query['to']) : undefined;

    if (timeframe === '1m') {
      const conditions = [eq(candles1m.instrumentId, inst.id)];
      if (fromDate) conditions.push(gte(candles1m.barTime, fromDate));
      if (toDate) conditions.push(lte(candles1m.barTime, toDate));

      const rows = await db
        .select()
        .from(candles1m)
        .where(and(...conditions))
        .orderBy(asc(candles1m.barTime))
        .limit(limit);

      return { symbol: params.symbol, timeframe, candles: rows };
    }

    const conditions = [
      eq(candlesResampled.instrumentId, inst.id),
      eq(candlesResampled.timeframe, timeframe),
    ];
    if (fromDate) conditions.push(gte(candlesResampled.barTime, fromDate));
    if (toDate) conditions.push(lte(candlesResampled.barTime, toDate));

    const rows = await db
      .select()
      .from(candlesResampled)
      .where(and(...conditions))
      .orderBy(asc(candlesResampled.barTime))
      .limit(limit);

    return { symbol: params.symbol, timeframe, candles: rows };
  })
  .get('/quote/:symbol', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [inst] = await db
      .select({ id: instruments.id, symbol: instruments.symbol })
      .from(instruments)
      .where(and(eq(instruments.symbol, params.symbol), eq(instruments.isActive, true)))
      .limit(1);

    if (!inst) {
      set.status = 404;
      return { error: `Instrument not found: ${params.symbol}` };
    }

    const [latest] = await db
      .select()
      .from(candles1m)
      .where(eq(candles1m.instrumentId, inst.id))
      .orderBy(desc(candles1m.barTime))
      .limit(1);

    return { symbol: params.symbol, quote: latest ?? null };
  })
  .get(
    '/quote',
    async ({ query, userId, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

      const marketOpen = Boolean(getMarketStatuses().find((m) => m.id === 'NSE_FNO')?.isOpen);
      try {
        const client = new UpstoxClient({
          analyticsToken: config.upstox.analyticsToken,
          accessToken: config.upstox.accessToken,
        });
        const quotes = await client.getQuote([query.instrumentKey]);
        const quote = quotes[query.instrumentKey] ?? Object.values(quotes)[0] ?? null;
        return { instrumentKey: query.instrumentKey, marketOpen, quote };
      } catch (err) {
        return {
          instrumentKey: query.instrumentKey,
          marketOpen,
          quote: null,
          error: err instanceof Error ? err.message : 'Quote unavailable',
        };
      }
    },
    { query: t.Object({ instrumentKey: t.String({ minLength: 1 }) }) },
  );
