import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { backtestRuns, backtestTrades, strategies } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';
import { logAuditEvent } from '../middleware/audit-middleware';

const RunBacktestSchema = z.object({
  strategyId: z.string().uuid(),
  name: z.string().max(255).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  initialCapital: z.number().positive().default(1_000_000),
});

export const backtestRoutes = new Elysia({ prefix: '/api/backtest' })
  .use(authPlugin)
  .post('/run', async ({ body, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const parsed = RunBacktestSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: 'Validation failed', details: parsed.error.flatten() };
    }

    if (parsed.data.endDate < parsed.data.startDate) {
      set.status = 400;
      return { error: 'endDate must be on or after startDate' };
    }

    const [strategy] = await db
      .select()
      .from(strategies)
      .where(and(eq(strategies.id, parsed.data.strategyId), eq(strategies.userId, userId)))
      .limit(1);

    if (!strategy) {
      set.status = 404;
      return { error: 'Strategy not found' };
    }

    const [run] = await db
      .insert(backtestRuns)
      .values({
        strategyId: strategy.id,
        userId,
        name: parsed.data.name ?? `${strategy.name} Backtest`,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        initialCapital: parsed.data.initialCapital.toFixed(2),
        status: 'queued',
        configSnapshot: strategy,
      })
      .returning();

    await logAuditEvent({
      userId,
      action: 'BACKTEST_ENQUEUED',
      entityType: 'backtest_run',
      entityId: run?.id,
      details: { strategyId: strategy.id, startDate: parsed.data.startDate, endDate: parsed.data.endDate },
    });

    set.status = 202;
    return { runId: run?.id, status: 'queued' };
  })
  .get('/runs', async ({ query, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const limit = Math.min(50, Math.max(1, Number((query as Record<string, string>)['limit'] ?? '20')));
    const runs = await db
      .select()
      .from(backtestRuns)
      .where(eq(backtestRuns.userId, userId))
      .orderBy(desc(backtestRuns.createdAt))
      .limit(limit);

    return { runs };
  })
  .get('/runs/:id', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [run] = await db
      .select()
      .from(backtestRuns)
      .where(and(eq(backtestRuns.id, params.id), eq(backtestRuns.userId, userId)))
      .limit(1);

    if (!run) {
      set.status = 404;
      return { error: 'Backtest run not found' };
    }

    return { run };
  })
  .get('/runs/:id/trades', async ({ params, query, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [run] = await db
      .select({ id: backtestRuns.id })
      .from(backtestRuns)
      .where(and(eq(backtestRuns.id, params.id), eq(backtestRuns.userId, userId)))
      .limit(1);

    if (!run) {
      set.status = 404;
      return { error: 'Backtest run not found' };
    }

    const page = Math.max(1, Number(query['page'] ?? '1'));
    const limit = Math.min(200, Math.max(1, Number(query['limit'] ?? '50')));
    const offset = (page - 1) * limit;

    const trades = await db
      .select()
      .from(backtestTrades)
      .where(eq(backtestTrades.backtestRunId, run.id))
      .orderBy(asc(backtestTrades.tradeNum))
      .limit(limit)
      .offset(offset);

    return { page, limit, trades };
  })
  .get('/runs/:id/equity', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [run] = await db
      .select()
      .from(backtestRuns)
      .where(and(eq(backtestRuns.id, params.id), eq(backtestRuns.userId, userId)))
      .limit(1);

    if (!run) {
      set.status = 404;
      return { error: 'Backtest run not found' };
    }

    const trades = await db
      .select({
        entryTime: backtestTrades.entryTime,
        exitTime: backtestTrades.exitTime,
        netPnl: backtestTrades.netPnl,
      })
      .from(backtestTrades)
      .where(eq(backtestTrades.backtestRunId, run.id))
      .orderBy(asc(backtestTrades.tradeNum));

    let equity = Number(run.initialCapital);
    let peak = equity;
    const equityCurve = [{ timestamp: run.startDate, equity, drawdown: 0 }];

    for (const t of trades) {
      equity += Number(t.netPnl ?? 0);
      if (equity > peak) peak = equity;
      const drawdown = peak > 0 ? (peak - equity) / peak : 0;
      equityCurve.push({
        timestamp: (t.exitTime ?? t.entryTime).toISOString(),
        equity,
        drawdown,
      });
    }

    return { equityCurve };
  });
