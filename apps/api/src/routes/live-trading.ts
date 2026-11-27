import { Elysia } from 'elysia';
import { z } from 'zod';
import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { authenticator } from 'otplib';
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
import { decrypt, getMasterKey } from '../utils/encryption';
import { logger } from '../logger';

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
      Number(portfolio?.dayStartValue ?? 0),
    );

    const tokenValid =
      Boolean(cred?.isActive) &&
      (!cred?.tokenExpiresAt || cred.tokenExpiresAt.getTime() > Date.now());

    const hasTwoFactor = Boolean(profile?.twoFactorEnabledAt);
    const liveArmed = Boolean(profile?.liveTradingEnabled) && envEnabled && hasTwoFactor;

    return {
      envEnabled,
      liveTradingEnabled: liveArmed,
      liveTradingRequested: Boolean(profile?.liveTradingEnabled),
      gates: {
        paperTradeCount: { actual: trades.length, required: 100, passed: trades.length >= 100 },
        profitFactor: {
          actual: Number.isFinite(profitFactor) ? Number(profitFactor.toFixed(2)) : '∞',
          required: 1.5,
          passed: profitFactor > 1.5,
        },
        maxDrawdownPct: { actual: Number(maxDrawdownPct.toFixed(2)), maxAllowed: 10, passed: maxDrawdownPct < 10 },
        operatorTwoFactor: { passed: hasTwoFactor },
        adminApproved: { passed: Boolean(profile?.liveTradingApprovedAt) },
        growwCredentials: { passed: tokenValid },
        envFlag: { passed: envEnabled },
      },
    };
  })
  .post('/enable', async ({ body, userId, userRole, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
    if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden: SUPER_ADMIN only' };

    const parsed = z
      .object({
        code: z.string().min(6).max(6, 'TOTP code must be 6 digits'),
        strategyIds: z.array(z.string()).optional(),
      })
      .safeParse(body ?? {});

    if (!parsed.success) {
      set.status = 400;
      return {
        error: 'A valid 6-digit operator TOTP code is required to enable live trading',
        code: '2FA_CODE_REQUIRED',
        issues: parsed.error.issues,
      };
    }

    const { code, strategyIds } = parsed.data;

    // 1. Fetch user profile and verify 2FA enrollment
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (!profile?.twoFactorSecretEncrypted || !profile?.twoFactorEnabledAt) {
      set.status = 400;
      return {
        error: 'Operator 2FA is not enrolled. Please set up 2FA in Settings before enabling live trading.',
        code: '2FA_NOT_ENROLLED',
      };
    }

    // 2. Validate submitted TOTP code using decrypted operator secret
    const masterKey = getMasterKey();
    const secret = decrypt(profile.twoFactorSecretEncrypted, masterKey);
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) {
      await logAuditEvent({
        userId,
        action: 'LIVE_TRADING_ENABLE_BLOCKED',
        entityType: 'user_profile',
        entityId: userId,
        details: { reason: 'invalid_operator_2fa_code' },
      });
      set.status = 401;
      return {
        error: 'Invalid 2FA code. Please enter the current 6-digit code from your authenticator app.',
        code: 'INVALID_2FA_CODE',
      };
    }

    // 3. Verify all 6 mandatory gates
    const envEnabled = process.env['ENABLE_LIVE_TRADING'] === 'true';
    if (!envEnabled) {
      set.status = 403;
      return { error: 'ENABLE_LIVE_TRADING environment variable is not true on server host' };
    }

    if (!profile.liveTradingApprovedAt) {
      set.status = 403;
      return { error: 'Live trading has not been approved by an administrator' };
    }

    const [cred] = await db
      .select({ isActive: growwCredentials.isActive, tokenExpiresAt: growwCredentials.tokenExpiresAt })
      .from(growwCredentials)
      .where(eq(growwCredentials.userId, userId))
      .limit(1);

    const tokenValid =
      Boolean(cred?.isActive) &&
      (!cred?.tokenExpiresAt || cred.tokenExpiresAt.getTime() > Date.now());

    if (!tokenValid) {
      set.status = 403;
      return { error: 'Broker credentials are not active or access token has expired' };
    }

    const [portfolio] = await db
      .select({ id: paperPortfolios.id, dayStartValue: paperPortfolios.dayStartValue })
      .from(paperPortfolios)
      .where(eq(paperPortfolios.userId, userId))
      .limit(1);

    const trades = portfolio
      ? await db
          .select({
            netPnl: paperTrades.netPnl,
            exitPrice: paperTrades.exitPrice,
            exitTime: paperTrades.exitTime,
          })
          .from(paperTrades)
          .where(
            and(
              eq(paperTrades.portfolioId, portfolio.id),
              isNotNull(paperTrades.exitTime),
              isNotNull(paperTrades.netPnl),
            ),
          )
          .orderBy(asc(paperTrades.exitTime))
      : [];

    if (trades.length < 100) {
      set.status = 403;
      return { error: `At least 100 completed paper trades required (found ${trades.length})` };
    }

    const { profitFactor, maxDrawdownPct } = calculatePaperPerformance(
      trades,
      Number(portfolio?.dayStartValue ?? 0),
    );

    if (profitFactor <= 1.5) {
      set.status = 403;
      return { error: `Paper profit factor (${profitFactor.toFixed(2)}) must be > 1.5` };
    }

    if (maxDrawdownPct >= 10) {
      set.status = 403;
      return { error: `Paper max drawdown (${maxDrawdownPct.toFixed(2)}%) must be < 10%` };
    }

    // 4. All gates passed with verified 2FA! Update profile & enqueue engine command
    await db
      .update(userProfiles)
      .set({ liveTradingEnabled: true, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));

    await logAuditEvent({
      userId,
      action: 'LIVE_TRADING_ENABLED',
      entityType: 'user_profile',
      entityId: userId,
      details: {
        paperTradeCount: trades.length,
        profitFactor,
        maxDrawdownPct,
        twoFactorVerifiedAt: new Date().toISOString(),
      },
    });

    const [cmd] = await db
      .insert(engineCommands)
      .values({
        userId,
        commandType: 'enable_live',
        payload: {
          enabled: true,
          twoFactorVerified: true,
          strategyIds,
          verifiedAt: new Date().toISOString(),
        },
        status: 'pending',
      })
      .returning();

    logger.info({ userId, commandId: cmd?.id }, 'Live trading enabled after verified step-up 2FA');
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
