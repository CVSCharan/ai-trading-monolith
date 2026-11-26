import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../db';
import {
  engineCommands,
  growwCredentials,
  liveFills,
  livePositions,
  paperPortfolios,
  paperTrades,
  userProfiles,
} from '../db/schema';
import { authPlugin, requireAuth, requireRole } from '../middleware/auth-middleware';
import { createRateLimitPlugin } from '../middleware/rate-limit-middleware';
import { logAuditEvent } from '../middleware/audit-middleware';

const EmergencyStopSchema = z.object({
  reason: z.string().min(1).max(255).default('Manual emergency stop'),
});

function calculatePaperPerformance(trades: Array<{ netPnl: string | null }>, startingCapital: number) {
  const pnls = trades.map((trade) => Number(trade.netPnl ?? 0));
  const wins = pnls.filter((pnl) => pnl > 0).reduce((sum, pnl) => sum + pnl, 0);
  const losses = Math.abs(pnls.filter((pnl) => pnl < 0).reduce((sum, pnl) => sum + pnl, 0));
  const profitFactor = losses > 0 ? wins / losses : wins > 0 ? Infinity : 0;

  if (!Number.isFinite(startingCapital) || startingCapital <= 0) {
    return { profitFactor, maxDrawdownPct: 100 };
  }

  let equity = startingCapital;
  let peak = equity;
  let maxDrawdownPct = 0;
  for (const pnl of pnls) {
    equity += pnl;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - equity) / peak) * 100);
  }
  return { profitFactor, maxDrawdownPct };
}

export const liveTradingRoutes = new Elysia({ prefix: '/api/live' })
  .use(authPlugin)
  .use(createRateLimitPlugin({ name: 'live-trading', maxRequests: 10, windowMs: 60_000 }))
  .get('/gates', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const envEnabled = process.env['ENABLE_LIVE_TRADING'] === 'true';
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    const [cred] = await db
      .select({ isActive: growwCredentials.isActive, tokenExpiresAt: growwCredentials.tokenExpiresAt })
      .from(growwCredentials)
      .where(eq(growwCredentials.userId, userId))
      .limit(1);

    const [portfolio] = await db
      .select({ id: paperPortfolios.id, dayStartValue: paperPortfolios.dayStartValue })
      .from(paperPortfolios)
      .where(eq(paperPortfolios.userId, userId))
      .limit(1);

    const trades = portfolio
      ? await db
          .select({ netPnl: paperTrades.netPnl })
          .from(paperTrades)
          .where(and(
            eq(paperTrades.portfolioId, portfolio.id),
            isNotNull(paperTrades.exitTime),
            isNotNull(paperTrades.netPnl),
          ))
          .orderBy(asc(paperTrades.exitTime))
      : [];

    const { profitFactor, maxDrawdownPct } = calculatePaperPerformance(
      trades,
      Number(profile?.paperCapital ?? 1000000),
    );

    const tokenValid =
      Boolean(cred?.isActive) &&
      (!cred?.tokenExpiresAt || cred.tokenExpiresAt.getTime() > Date.now());

    return {
      envEnabled,
      liveTradingEnabled: Boolean(profile?.liveTradingEnabled),
      gates: {
        paperTradeCount: { actual: trades.length, required: 100, passed: trades.length >= 100 },
        profitFactor: { actual: Number(profitFactor.toFixed(2)), required: 1.5, passed: profitFactor > 1.5 },
        maxDrawdownPct: { actual: Number(maxDrawdownPct.toFixed(2)), maxAllowed: 10, passed: maxDrawdownPct < 10 },
        adminApproved: { passed: Boolean(profile?.liveTradingApprovedAt) },
        growwCredentials: { passed: tokenValid },
        envFlag: { passed: envEnabled },
      },
    };
  })
  .post('/enable', async ({ userId, userRole, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
    if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden: SUPER_ADMIN only' };

    if (process.env['ENABLE_LIVE_TRADING'] !== 'true') {
      set.status = 403;
      return { error: 'Live trading is disabled by server environment flag (ENABLE_LIVE_TRADING=false)' };
    }

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (!profile?.liveTradingApprovedAt) {
      set.status = 403;
      return { error: 'Admin approval (liveTradingApprovedAt) is required before enabling live trading' };
    }

    const [cred] = await db
      .select({ isActive: growwCredentials.isActive, tokenExpiresAt: growwCredentials.tokenExpiresAt })
      .from(growwCredentials)
      .where(eq(growwCredentials.userId, userId))
      .limit(1);

    if (!cred?.isActive) {
      set.status = 400;
      return { error: 'Active Groww credentials are required' };
    }

    // Gate: >= 100 paper trades with PF > 1.5
    const [portfolio] = await db
      .select({ id: paperPortfolios.id })
      .from(paperPortfolios)
      .where(eq(paperPortfolios.userId, userId))
      .limit(1);

    const trades = portfolio
      ? await db
          .select({ netPnl: paperTrades.netPnl })
          .from(paperTrades)
          .where(and(
            eq(paperTrades.portfolioId, portfolio.id),
            isNotNull(paperTrades.exitTime),
            isNotNull(paperTrades.netPnl),
          ))
          .orderBy(asc(paperTrades.exitTime))
      : [];

    if (trades.length < 100) {
      set.status = 403;
      return {
        error: `Paper trading gate not met: ${trades.length}/100 completed paper trades logged`,
      };
    }

    const { profitFactor, maxDrawdownPct } = calculatePaperPerformance(
      trades,
      Number(profile.paperCapital ?? 1000000),
    );

    if (profitFactor <= 1.5) {
      set.status = 403;
      return { error: `Paper profit factor (${profitFactor.toFixed(2)}) must be > 1.5` };
    }

    if (maxDrawdownPct >= 10) {
      set.status = 403;
      return { error: `Paper max drawdown (${maxDrawdownPct.toFixed(2)}%) must be < 10%` };
    }

    await db
      .update(userProfiles)
      .set({ liveTradingEnabled: true, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));

    await logAuditEvent({
      userId,
      action: 'LIVE_TRADING_ENABLED',
      entityType: 'user_profile',
      entityId: userId,
      details: { paperTradeCount: trades.length, profitFactor },
    });

    // Enqueue enable_live command so engine activates live strategy generators
    const [cmd] = await db
      .insert(engineCommands)
      .values({
        userId,
        commandType: 'enable_live',
        payload: {
          enabled: true,
          twoFactorVerified: true,
        },
        status: 'pending',
      })
      .returning();

    return { enabled: true, commandId: cmd?.id };
  })
  .post('/emergency-stop', async ({ body, userId, userRole, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
    if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden: SUPER_ADMIN only' };

    const parsed = EmergencyStopSchema.safeParse(body ?? {});
    const reason = parsed.success ? parsed.data.reason : 'Manual emergency stop';

    await db
      .update(userProfiles)
      .set({ liveTradingEnabled: false, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));

    const [cmd] = await db
      .insert(engineCommands)
      .values({
        userId,
        commandType: 'emergency_stop',
        // Emergency stops always request both actions. The engine also applies
        // these defaults so older or malformed command producers fail safe.
        payload: { cancelOrders: true, closePositions: true, reason },
        status: 'pending',
      })
      .returning();

    await logAuditEvent({
      userId,
      action: 'EMERGENCY_STOP_TRIGGERED',
      entityType: 'engine_command',
      entityId: cmd?.id,
      details: { reason },
    });

    set.status = 202;
    // Commands are processed asynchronously by the engine poller. Do not
    // claim positions are closed until broker execution has been confirmed.
    return { requested: true, commandId: cmd?.id };
  })
  .get('/orders', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const orders = await db
      .select()
      .from(liveFills)
      .where(eq(liveFills.userId, userId))
      .orderBy(desc(liveFills.placedAt))
      .limit(100);

    return { orders };
  })
  .get('/positions', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const positions = await db
      .select()
      .from(livePositions)
      .where(and(eq(livePositions.userId, userId), isNull(livePositions.closedAt)))
      .orderBy(desc(livePositions.openedAt));

    return { positions };
  });
