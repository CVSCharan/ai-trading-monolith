import { Elysia } from 'elysia';
import { and, asc, desc, eq, gte, gt, lt, lte } from 'drizzle-orm';
import { db } from '../db';
import { backtestRuns, backtestTrades, candles1m, instruments } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';

export const tradeRoutes = new Elysia({ prefix: '/api/trades' })
  .use(authPlugin)
  .get('/:id', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [trade] = await db
      .select({ trade: backtestTrades, runUserId: backtestRuns.userId, run: backtestRuns })
      .from(backtestTrades)
      .innerJoin(backtestRuns, eq(backtestTrades.backtestRunId, backtestRuns.id))
      .where(and(eq(backtestTrades.id, params.id), eq(backtestRuns.userId, userId)))
      .limit(1);

    if (!trade) {
      set.status = 404;
      return { error: 'Trade not found' };
    }

    return { trade: trade.trade };
  })
  .get('/:id/chart-data', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [row] = await db
      .select({ trade: backtestTrades })
      .from(backtestTrades)
      .innerJoin(backtestRuns, eq(backtestTrades.backtestRunId, backtestRuns.id))
      .where(and(eq(backtestTrades.id, params.id), eq(backtestRuns.userId, userId)))
      .limit(1);

    if (!row) {
      set.status = 404;
      return { error: 'Trade not found' };
    }

    const { trade } = row;
    const windowStart = new Date(trade.entryTime.getTime() - 30 * 60_000);
    const windowEnd = new Date((trade.exitTime ?? trade.entryTime).getTime() + 30 * 60_000);

    const [inst] = await db
      .select({ id: instruments.id })
      .from(instruments)
      .where(and(eq(instruments.symbol, trade.symbol), eq(instruments.instrumentType, 'INDEX')))
      .limit(1);

    const candles = inst
      ? await db
          .select()
          .from(candles1m)
          .where(
            and(
              eq(candles1m.instrumentId, inst.id),
              gte(candles1m.barTime, windowStart),
              lte(candles1m.barTime, windowEnd)
            )
          )
          .orderBy(asc(candles1m.barTime))
      : [];

    return { trade, candles, windowStart, windowEnd };
  })
  .get('/:id/adjacent', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [row] = await db
      .select({ trade: backtestTrades })
      .from(backtestTrades)
      .innerJoin(backtestRuns, eq(backtestTrades.backtestRunId, backtestRuns.id))
      .where(and(eq(backtestTrades.id, params.id), eq(backtestRuns.userId, userId)))
      .limit(1);

    if (!row) {
      set.status = 404;
      return { error: 'Trade not found' };
    }

    const { trade } = row;
    const [prev] = await db
      .select({ id: backtestTrades.id, tradeNum: backtestTrades.tradeNum })
      .from(backtestTrades)
      .where(
        and(
          eq(backtestTrades.backtestRunId, trade.backtestRunId),
          lt(backtestTrades.tradeNum, trade.tradeNum)
        )
      )
      .orderBy(desc(backtestTrades.tradeNum))
      .limit(1);

    const [next] = await db
      .select({ id: backtestTrades.id, tradeNum: backtestTrades.tradeNum })
      .from(backtestTrades)
      .where(
        and(
          eq(backtestTrades.backtestRunId, trade.backtestRunId),
          gt(backtestTrades.tradeNum, trade.tradeNum)
        )
      )
      .orderBy(asc(backtestTrades.tradeNum))
      .limit(1);

    return { prevId: prev?.id ?? null, nextId: next?.id ?? null };
  });
