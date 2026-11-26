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
import { authPlugin, requireAuth, requireRole } from '../middleware/auth-middleware';
import { logAuditEvent } from '../middleware/audit-middleware';

const PaperOrderSchema = z.object({
  symbol: z.string().trim().min(1).max(100).transform((s) => s.toUpperCase()),
  side: z.enum(['BUY', 'SELL']).default('BUY'),
  quantity: z.number().int().min(1).max(100_000),
  price: z.number().positive(),
});

const PaperCloseSchema = z.object({
  exitPrice: z.number().positive().optional(),
});

const PaperResetSchema = z.object({
  capital: z.number().min(10_000).max(100_000_000).default(1_000_000),
});
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
  })
  .post('/order', async ({ body, userId, userRole, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
    if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden: SUPER_ADMIN only' };

    const parsed = PaperOrderSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: 'Validation failed', details: parsed.error.flatten() };
    }

    let [portfolio] = await db
      .select()
      .from(paperPortfolios)
      .where(eq(paperPortfolios.userId, userId))
      .limit(1);

    if (!portfolio) {
      [portfolio] = await db
        .insert(paperPortfolios)
        .values({
          userId,
          cashBalance: '1000000',
          totalValue: '1000000',
          dayStartValue: '1000000',
          dailyPnl: '0',
          isActive: true,
          sessionStartedAt: new Date(),
        })
        .returning();
    }

    const notional = parsed.data.price * parsed.data.quantity;
    const currentCash = Number(portfolio.cashBalance);
    if (parsed.data.side === 'BUY' && notional > currentCash) {
      set.status = 400;
      return { error: `Insufficient paper cash (need ₹${notional.toFixed(0)}, available ₹${currentCash.toFixed(0)})` };
    }

    const tradeSide = parsed.data.side === 'BUY' ? 'LONG' : 'SHORT';
    const [position] = await db
      .insert(paperPositions)
      .values({
        portfolioId: portfolio.id,
        optionSymbol: parsed.data.symbol,
        side: tradeSide,
        quantity: parsed.data.quantity,
        avgEntryPrice: String(parsed.data.price),
        currentPrice: String(parsed.data.price),
        unrealizedPnl: '0',
      })
      .returning();

    const updatedCash = parsed.data.side === 'BUY' ? currentCash - notional : currentCash + notional;
    await db
      .update(paperPortfolios)
      .set({ cashBalance: String(updatedCash), updatedAt: new Date() })
      .where(eq(paperPortfolios.id, portfolio.id));

    await logAuditEvent({
      userId,
      action: 'PAPER_MANUAL_ORDER',
      entityType: 'paper_position',
      entityId: position?.id,
      details: parsed.data,
    });

    set.status = 201;
    return { position };
  })
  .post('/close/:id', async ({ params, body, userId, userRole, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
    if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden: SUPER_ADMIN only' };

    const parsed = PaperCloseSchema.safeParse(body ?? {});
    const [portfolio] = await db
      .select()
      .from(paperPortfolios)
      .where(eq(paperPortfolios.userId, userId))
      .limit(1);

    if (!portfolio) {
      set.status = 404;
      return { error: 'Paper portfolio not found' };
    }

    const [pos] = await db
      .select()
      .from(paperPositions)
      .where(and(eq(paperPositions.id, params.id), eq(paperPositions.portfolioId, portfolio.id), isNull(paperPositions.closedAt)))
      .limit(1);

    if (!pos) {
      set.status = 404;
      return { error: 'Open paper position not found' };
    }

    const entryPrice = Number(pos.avgEntryPrice);
    const exitPrice = parsed.success && parsed.data.exitPrice ? parsed.data.exitPrice : Number(pos.currentPrice ?? entryPrice);
    const grossPnl =
      pos.side === 'LONG'
        ? (exitPrice - entryPrice) * pos.quantity
        : (entryPrice - exitPrice) * pos.quantity;
    const costs = 40;
    const netPnl = grossPnl - costs;

    await db
      .update(paperPositions)
      .set({
        currentPrice: String(exitPrice),
        realizedPnl: String(netPnl),
        unrealizedPnl: '0',
        closedAt: new Date(),
        closedReason: 'MANUAL',
      })
      .where(eq(paperPositions.id, pos.id));

    const [trade] = await db
      .insert(paperTrades)
      .values({
        portfolioId: portfolio.id,
        optionSymbol: pos.optionSymbol,
        side: pos.side === 'LONG' ? 'BUY' : 'SELL',
        entryTime: pos.openedAt,
        entryPrice: String(entryPrice),
        exitTime: new Date(),
        exitPrice: String(exitPrice),
        quantity: pos.quantity,
        grossPnl: String(grossPnl),
        costs: String(costs),
        netPnl: String(netPnl),
        exitReason: 'MANUAL',
        fillMetadata: { manual: true },
      })
      .returning();

    const newCash =
      pos.side === 'LONG'
        ? Number(portfolio.cashBalance) + exitPrice * pos.quantity - costs
        : Number(portfolio.cashBalance) - exitPrice * pos.quantity - costs;
    const newDailyPnl = Number(portfolio.dailyPnl ?? 0) + netPnl;
    const newTotal = Number(portfolio.totalValue) + netPnl;

    await db
      .update(paperPortfolios)
      .set({
        cashBalance: String(newCash),
        totalValue: String(newTotal),
        dailyPnl: String(newDailyPnl),
        updatedAt: new Date(),
      })
      .where(eq(paperPortfolios.id, portfolio.id));

    await logAuditEvent({
      userId,
      action: 'PAPER_POSITION_CLOSED',
      entityType: 'paper_trade',
      entityId: trade?.id,
      details: { symbol: pos.optionSymbol, exitPrice, netPnl },
    });

    return { trade, netPnl };
  })
  .post('/reset', async ({ body, userId, userRole, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
    if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden: SUPER_ADMIN only' };

    const parsed = PaperResetSchema.safeParse(body ?? {});
    const capital = parsed.success ? parsed.data.capital : 1_000_000;

    const [portfolio] = await db
      .insert(paperPortfolios)
      .values({
        userId,
        cashBalance: String(capital),
        totalValue: String(capital),
        dayStartValue: String(capital),
        dailyPnl: '0',
        isActive: true,
        sessionStartedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: paperPortfolios.userId,
        set: {
          cashBalance: String(capital),
          totalValue: String(capital),
          dayStartValue: String(capital),
          dailyPnl: '0',
          updatedAt: new Date(),
        },
      })
      .returning();

    if (portfolio) {
      await db
        .update(paperPositions)
        .set({ closedAt: new Date(), closedReason: 'MANUAL_RESET' })
        .where(and(eq(paperPositions.portfolioId, portfolio.id), isNull(paperPositions.closedAt)));
    }

    await logAuditEvent({
      userId,
      action: 'PAPER_CAPITAL_RESET',
      entityType: 'paper_portfolio',
      entityId: portfolio?.id,
      details: { capital },
    });

    return { portfolio };
  });
