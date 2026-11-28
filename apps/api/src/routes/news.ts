import { Elysia, t } from 'elysia';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import { aiMarketBriefs, marketNews, watchlists } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';
import { createRateLimitPlugin } from '../middleware/rate-limit-middleware';
import { generateAndStoreMarketBrief, refreshWatchlistNews } from '../services/news-service';

export const newsRoutes = new Elysia({ prefix: '/api/news' })
  .use(authPlugin)
  .use(createRateLimitPlugin({ name: 'news', maxRequests: 30, windowMs: 60_000 }))
  .get(
    '/',
    async ({ query, userId, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

      const limit = Math.min(Math.max(Number(query.limit ?? 30), 1), 100);
      const symbolFilter = query.symbol?.trim().toUpperCase();
      const sentimentFilter = query.sentiment?.trim().toUpperCase();

      const pinned = await db
        .select({ symbol: watchlists.symbol })
        .from(watchlists)
        .where(eq(watchlists.userId, userId));

      const pinnedSymbols = Array.from(
        new Set(['NIFTY', 'BANKNIFTY', ...pinned.map((p) => p.symbol.toUpperCase())])
      );

      const conditions = [];
      if (symbolFilter && symbolFilter !== 'ALL') {
        conditions.push(eq(marketNews.symbol, symbolFilter));
      } else if (query.watchlistOnly === 'true') {
        conditions.push(or(isNull(marketNews.symbol), inArray(marketNews.symbol, pinnedSymbols)));
      }
      if (sentimentFilter && sentimentFilter !== 'ALL') {
        conditions.push(eq(marketNews.sentiment, sentimentFilter));
      }

      const items = await db
        .select()
        .from(marketNews)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(marketNews.publishedAt))
        .limit(limit);

      return { items, pinnedSymbols };
    },
    {
      query: t.Object({
        symbol: t.Optional(t.String()),
        sentiment: t.Optional(t.String()),
        watchlistOnly: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )
  .get('/brief', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [latest] = await db
      .select()
      .from(aiMarketBriefs)
      .where(eq(aiMarketBriefs.userId, userId))
      .orderBy(desc(aiMarketBriefs.createdAt))
      .limit(1);

    if (latest) return { brief: latest };

    const pinned = await db
      .select({ symbol: watchlists.symbol })
      .from(watchlists)
      .where(eq(watchlists.userId, userId));
    const pinnedSymbols = Array.from(
      new Set(['NIFTY', 'BANKNIFTY', ...pinned.map((p) => p.symbol.toUpperCase())])
    );

    const created = await generateAndStoreMarketBrief(userId, pinnedSymbols);
    return { brief: created };
  })
  .post('/refresh', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
    const result = await refreshWatchlistNews(userId);
    return { ok: true, ...result };
  });
