import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { strategies } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';
import { logAuditEvent } from '../middleware/audit-middleware';

const StrategyBodySchema = z.object({
  name: z.string().min(1).max(255),
  underlyingSymbol: z.string().trim().min(1).max(30).transform((s) => s.toUpperCase()).default('NIFTY'),
  timeframe: z.enum(['5m', '15m', '30m']),
  entryStartTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  entryEndTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  exitTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default('15:00:00'),
  executionMode: z.enum(['DEEP_ITM_BUY', 'ATM_BUY', 'ATM_SELL']),
  strikeOffset: z.number().int().min(0).max(20).default(5),
  lots: z.number().int().min(1).max(100).default(1),
  expiryPreference: z.enum(['WEEKLY', 'MONTHLY']).default('WEEKLY'),
  avoidExpiryDays: z.number().int().min(0).max(10).default(2),
  riskParams: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true),
});

const StrategyUpdateSchema = StrategyBodySchema.partial();

export const strategyRoutes = new Elysia({ prefix: '/api/strategies' })
  .use(authPlugin)
  .get('/', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const rows = await db
      .select()
      .from(strategies)
      .where(eq(strategies.userId, userId))
      .orderBy(desc(strategies.createdAt));

    return { strategies: rows };
  })
  .post('/', async ({ body, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const parsed = StrategyBodySchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: 'Validation failed', details: parsed.error.flatten() };
    }

    const [created] = await db
      .insert(strategies)
      .values({
        userId,
        ...parsed.data,
      })
      .returning();

    await logAuditEvent({
      userId,
      action: 'STRATEGY_CREATED',
      entityType: 'strategy',
      entityId: created?.id,
      details: { name: parsed.data.name },
    });

    set.status = 201;
    return { strategy: created };
  })
  .get('/:id', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [row] = await db
      .select()
      .from(strategies)
      .where(and(eq(strategies.id, params.id), eq(strategies.userId, userId)))
      .limit(1);

    if (!row) {
      set.status = 404;
      return { error: 'Strategy not found' };
    }

    return { strategy: row };
  })
  .patch('/:id', async ({ params, body, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const parsed = StrategyUpdateSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: 'Validation failed', details: parsed.error.flatten() };
    }

    const [updated] = await db
      .update(strategies)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(strategies.id, params.id), eq(strategies.userId, userId)))
      .returning();

    if (!updated) {
      set.status = 404;
      return { error: 'Strategy not found' };
    }

    await logAuditEvent({
      userId,
      action: 'STRATEGY_UPDATED',
      entityType: 'strategy',
      entityId: updated.id,
    });

    return { strategy: updated };
  })
  .delete('/:id', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [deleted] = await db
      .delete(strategies)
      .where(and(eq(strategies.id, params.id), eq(strategies.userId, userId)))
      .returning({ id: strategies.id });

    if (!deleted) {
      set.status = 404;
      return { error: 'Strategy not found' };
    }

    await logAuditEvent({
      userId,
      action: 'STRATEGY_DELETED',
      entityType: 'strategy',
      entityId: deleted.id,
    });

    return { deleted: true, id: deleted.id };
  })
  .post('/:id/clone', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [source] = await db
      .select()
      .from(strategies)
      .where(and(eq(strategies.id, params.id), eq(strategies.userId, userId)))
      .limit(1);

    if (!source) {
      set.status = 404;
      return { error: 'Strategy not found' };
    }

    const [cloned] = await db
      .insert(strategies)
      .values({
        userId,
        name: `${source.name} (Copy)`,
        underlyingSymbol: source.underlyingSymbol,
        timeframe: source.timeframe,
        entryStartTime: source.entryStartTime,
        entryEndTime: source.entryEndTime,
        exitTime: source.exitTime,
        executionMode: source.executionMode,
        strikeOffset: source.strikeOffset,
        lots: source.lots,
        expiryPreference: source.expiryPreference,
        avoidExpiryDays: source.avoidExpiryDays,
        riskParams: source.riskParams,
        isActive: false,
      })
      .returning();

    set.status = 201;
    return { strategy: cloned };
  });
