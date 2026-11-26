// ============================================
// Watchlist Routes (S8-001: DB-backed Custom Watchlist)
// ============================================

import { Elysia, t } from 'elysia';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../db';
import { instruments, watchlists } from '../db/schema';
import { authPlugin, requireAuth, requireRole } from '../middleware/auth-middleware';
import { createRateLimitPlugin } from '../middleware/rate-limit-middleware';

export const watchlistRoutes = new Elysia({ prefix: '/api/watchlist' })
  .use(authPlugin)
  .use(createRateLimitPlugin({ name: 'watchlist', maxRequests: 60, windowMs: 60_000 }))

  // ── GET /api/watchlist ────────────────────────────────────────
  .get('/', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const items = await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(asc(watchlists.sortOrder), asc(watchlists.createdAt));

    return { items };
  })

  // ── GET /api/watchlist/search?q=NIFTY ─────────────────────────
  .get(
    '/search',
    async ({ query, userId, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

      const q = (query.q ?? '').trim();
      if (!q) {
        const defaults = await db
          .select({
            symbol: instruments.symbol,
            name: instruments.name,
            exchange: instruments.exchange,
            segment: instruments.segment,
            instrumentType: instruments.instrumentType,
            growwToken: instruments.growwToken,
          })
          .from(instruments)
          .where(eq(instruments.isActive, true))
          .limit(15);
        return { results: defaults };
      }

      const pattern = `%${q}%`;
      const results = await db
        .select({
          symbol: instruments.symbol,
          name: instruments.name,
          exchange: instruments.exchange,
          segment: instruments.segment,
          instrumentType: instruments.instrumentType,
          growwToken: instruments.growwToken,
        })
        .from(instruments)
        .where(or(ilike(instruments.symbol, pattern), ilike(instruments.name, pattern)))
        .limit(20);

      return { results };
    },
    { query: t.Object({ q: t.Optional(t.String()) }) },
  )

  // ── POST /api/watchlist ───────────────────────────────────────
  .post(
    '/',
    async ({ body, userId, userRole, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
      if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden: SUPER_ADMIN only' };

      const [inserted] = await db
        .insert(watchlists)
        .values({
          userId,
          symbol: body.symbol.toUpperCase(),
          exchange: body.exchange ?? 'NSE',
          segment: body.segment ?? 'FO',
          instrumentKey: body.instrumentKey ?? null,
          notes: body.notes ?? null,
          sortOrder: body.sortOrder ?? 0,
        })
        .onConflictDoUpdate({
          target: [watchlists.userId, watchlists.symbol, watchlists.exchange],
          set: {
            segment: body.segment ?? 'FO',
            instrumentKey: body.instrumentKey ?? null,
            notes: body.notes ?? null,
          },
        })
        .returning();

      set.status = 201;
      return { item: inserted };
    },
    {
      body: t.Object({
        symbol: t.String({ minLength: 1, maxLength: 100 }),
        exchange: t.Optional(t.String()),
        segment: t.Optional(t.String()),
        instrumentKey: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        sortOrder: t.Optional(t.Number()),
      }),
    },
  )

  // ── DELETE /api/watchlist/:id ─────────────────────────────────
  .delete('/:id', async ({ params, userId, userRole, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
    if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden: SUPER_ADMIN only' };

    const deleted = await db
      .delete(watchlists)
      .where(and(eq(watchlists.id, params.id), eq(watchlists.userId, userId)))
      .returning({ id: watchlists.id });

    if (deleted.length === 0) {
      set.status = 404;
      return { error: 'Watchlist item not found' };
    }
    return { deleted: true, id: params.id };
  });
