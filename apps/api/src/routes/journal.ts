import { Elysia, t } from 'elysia';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeJournalEntries } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';

export const journalRoutes = new Elysia({ prefix: '/api/journal' })
  .use(authPlugin)
  .get(
    '/',
    async ({ query, userId, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

      const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 200);
      const source = query.tradeSource?.trim().toUpperCase();

      const whereClause = source
        ? and(eq(tradeJournalEntries.userId, userId), eq(tradeJournalEntries.tradeSource, source))
        : eq(tradeJournalEntries.userId, userId);

      const entries = await db
        .select()
        .from(tradeJournalEntries)
        .where(whereClause)
        .orderBy(desc(tradeJournalEntries.updatedAt))
        .limit(limit);

      const total = entries.length;
      const followedCount = entries.filter((e) => e.followedRules).length;
      const avgRating =
        total > 0 ? Number((entries.reduce((s, e) => s + e.rating, 0) / total).toFixed(2)) : 0;

      return {
        entries,
        stats: {
          total,
          ruleAdherencePct: total > 0 ? Number(((followedCount / total) * 100).toFixed(1)) : 100,
          avgRating,
        },
      };
    },
    {
      query: t.Object({
        tradeSource: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )
  .get('/:tradeId', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [entry] = await db
      .select()
      .from(tradeJournalEntries)
      .where(
        and(
          eq(tradeJournalEntries.userId, userId),
          eq(tradeJournalEntries.tradeId, params.tradeId)
        )
      )
      .limit(1);

    return { entry: entry ?? null };
  })
  .put(
    '/:tradeId',
    async ({ params, body, userId, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

      const [saved] = await db
        .insert(tradeJournalEntries)
        .values({
          userId,
          tradeId: params.tradeId,
          tradeSource: body.tradeSource ?? 'BACKTEST',
          setupTag: body.setupTag ?? '9_21_EMA',
          emotionTag: body.emotionTag ?? 'CALM',
          followedRules: body.followedRules ?? true,
          rating: body.rating ?? 4,
          notes: body.notes ?? '',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [tradeJournalEntries.userId, tradeJournalEntries.tradeId],
          set: {
            tradeSource: body.tradeSource ?? 'BACKTEST',
            setupTag: body.setupTag ?? '9_21_EMA',
            emotionTag: body.emotionTag ?? 'CALM',
            followedRules: body.followedRules ?? true,
            rating: body.rating ?? 4,
            notes: body.notes ?? '',
            updatedAt: new Date(),
          },
        })
        .returning();

      return { entry: saved };
    },
    {
      body: t.Object({
        tradeSource: t.Optional(t.Union([t.Literal('BACKTEST'), t.Literal('PAPER'), t.Literal('LIVE')])),
        setupTag: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
        emotionTag: t.Optional(t.String({ minLength: 1, maxLength: 30 })),
        followedRules: t.Optional(t.Boolean()),
        rating: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
        notes: t.Optional(t.String({ maxLength: 4000 })),
      }),
    }
  );
