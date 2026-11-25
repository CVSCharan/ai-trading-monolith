import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, desc, eq, isNull } from 'drizzle-orm';
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
import { authPlugin, requireAuth } from '../middleware/auth-middleware';
import { createRateLimitPlugin } from '../middleware/rate-limit-middleware';
import { logAuditEvent } from '../middleware/audit-middleware';

const EmergencyStopSchema = z.object({
  reason: z.string().min(1).max(255).default('Manual emergency stop'),
});

export const liveTradingRoutes = new Elysia({ prefix: '/api/live' })
  .use(authPlugin)
  .use(createRateLimitPlugin({ name: 'live-trading', maxRequests: 10, windowMs: 60_000 }))
  .post('/enable', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

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
          .where(eq(paperTrades.portfolioId, portfolio.id))
      : [];

    if (trades.length < 100) {
      set.status = 403;
      return {
        error: `Paper trading gate not met: ${trades.length}/100 completed paper trades logged`,
      };
    }

    const pnls = trades.map((t) => Number(t.netPnl ?? 0));
    const wins = pnls.filter((p) => p > 0).reduce((s, p) => s + p, 0);
    const losses = Math.abs(pnls.filter((p) => p < 0).reduce((s, p) => s + p, 0));
    const profitFactor = losses > 0 ? wins / losses : wins > 0 ? Infinity : 0;

    if (profitFactor <= 1.5) {
      set.status = 403;
      return { error: `Paper profit factor (${profitFactor.toFixed(2)}) must be > 1.5` };
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

    return { enabled: true };
  })
  .post('/emergency-stop', async ({ body, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

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
        payload: { reason },
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
    return { stopped: true, commandId: cmd?.id };
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
