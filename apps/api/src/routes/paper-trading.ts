import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import {
  engineCommands,
  paperPortfolios,
  paperPositions,
  paperTrades,
  strategies,
} from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';
import { logAuditEvent } from '../middleware/audit-middleware';
import { validateOrderRisk } from '../middleware/risk-middleware';

const StartPaperSchema = z.object({
  strategyId: z.string().uuid(),
});

export const paperTradingRoutes = new Elysia({ prefix: '/api/paper' })
  .use(authPlugin)
  .post('/start', async ({ body, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const parsed = StartPaperSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: 'Validation failed', details: parsed.error.flatten() };
    }

    const risk = await validateOrderRisk(userId, 'paper');
    if (!risk.allowed) {
      set.status = 403;
      return { error: risk.reason };
    }

    const [strategy] = await db
      .select({ id: strategies.id })
      .from(strategies)
      .where(and(eq(strategies.id, parsed.data.strategyId), eq(strategies.userId, userId)))
      .limit(1);

    if (!strategy) {
      set.status = 404;
      return { error: 'Strategy not found' };
    }

    const [cmd] = await db
      .insert(engineCommands)
      .values({
        userId,
        commandType: 'start_paper',
        payload: { strategyId: strategy.id },
        status: 'pending',
      })
      .returning();

    await logAuditEvent({
      userId,
      action: 'PAPER_SESSION_START_REQUESTED',
      entityType: 'engine_command',
      entityId: cmd?.id,
      details: { strategyId: strategy.id },
    });

    set.status = 202;
    return { commandId: cmd?.id, status: 'pending' };
  })
  .post('/stop', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [cmd] = await db
      .insert(engineCommands)
      .values({
        userId,
        commandType: 'stop_paper',
        payload: {},
        status: 'pending',
      })
      .returning();

    await logAuditEvent({
      userId,
      action: 'PAPER_SESSION_STOP_REQUESTED',
      entityType: 'engine_command',
      entityId: cmd?.id,
    });

    set.status = 202;
    return { commandId: cmd?.id, status: 'pending' };
  })
  .get('/portfolio', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [portfolio] = await db
      .select()
      .from(paperPortfolios)
      .where(eq(paperPortfolios.userId, userId))
      .limit(1);

    return { portfolio: portfolio ?? null };
  })
  .get('/positions', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [portfolio] = await db
      .select({ id: paperPortfolios.id })
      .from(paperPortfolios)
      .where(eq(paperPortfolios.userId, userId))
      .limit(1);

    if (!portfolio) return { positions: [] };

    const positions = await db
      .select()
      .from(paperPositions)
      .where(and(eq(paperPositions.portfolioId, portfolio.id), isNull(paperPositions.closedAt)))
      .orderBy(desc(paperPositions.openedAt));

    return { positions };
  })
  .get('/history', async ({ query, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [portfolio] = await db
      .select({ id: paperPortfolios.id })
      .from(paperPortfolios)
      .where(eq(paperPortfolios.userId, userId))
      .limit(1);

    if (!portfolio) return { trades: [] };

    const limit = Math.min(200, Math.max(1, Number(query['limit'] ?? '50')));
    const trades = await db
      .select()
      .from(paperTrades)
      .where(eq(paperTrades.portfolioId, portfolio.id))
      .orderBy(desc(paperTrades.entryTime))
      .limit(limit);

    return { trades };
  });
