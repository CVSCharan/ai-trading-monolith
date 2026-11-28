import { Elysia, t } from 'elysia';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { priceAlerts } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';

export const alertRoutes = new Elysia({ prefix: '/api/alerts' })
  .use(authPlugin)
  .get('/', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const items = await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, userId))
      .orderBy(desc(priceAlerts.createdAt))
      .limit(50);

    return { items };
  })
  .post(
    '/',
    async ({ body, userId, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

      const [created] = await db
        .insert(priceAlerts)
        .values({
          userId,
          symbol: body.symbol.trim().toUpperCase(),
          condition: body.condition,
          targetPrice: body.targetPrice.toFixed(2),
          isActive: true,
        })
        .returning();

      set.status = 201;
      return { item: created };
    },
    {
      body: t.Object({
        symbol: t.String({ minLength: 1, maxLength: 50 }),
        condition: t.Union([t.Literal('ABOVE'), t.Literal('BELOW')]),
        targetPrice: t.Number({ minimum: 0.05 }),
      }),
    }
  )
  .delete('/:id', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const deleted = await db
      .delete(priceAlerts)
      .where(and(eq(priceAlerts.id, params.id), eq(priceAlerts.userId, userId)))
      .returning({ id: priceAlerts.id });

    if (deleted.length === 0) {
      set.status = 404;
      return { error: 'Alert not found' };
    }
    return { deleted: true, id: params.id };
  });
