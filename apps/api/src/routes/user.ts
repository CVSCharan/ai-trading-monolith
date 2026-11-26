import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { userProfiles } from '../db/schema';
import { authPlugin, requireAuth, requireRole } from '../middleware/auth-middleware';
import { logAuditEvent } from '../middleware/audit-middleware';

const ProfileUpdateSchema = z.object({
  displayName: z.string().min(1).max(100),
  timezone: z.string().min(1).max(50).default('Asia/Kolkata'),
});

const RiskLimitsSchema = z.object({
  maxDailyLossPct: z.number().min(0.1).max(20),
  maxPositions: z.number().int().min(1).max(20),
  maxPositionsPerStrategy: z.number().int().min(1).max(10).default(1),
  perTradeRiskPct: z.number().min(0.1).max(10),
  shortOptionStopLossPct: z.number().min(10).max(500).default(100),
});

export const userRoutes = new Elysia({ prefix: '/api/user' })
  .use(authPlugin)
  .get('/profile', async ({ userId, sessionUser, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    return {
      user: sessionUser,
      profile: profile ?? null,
    };
  })
  .patch('/profile', async ({ body, userId, userRole, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
    if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden: SUPER_ADMIN only' };

    const parsed = ProfileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: 'Validation failed', details: parsed.error.flatten() };
    }

    const [updated] = await db
      .insert(userProfiles)
      .values({
        userId,
        displayName: parsed.data.displayName,
        timezone: parsed.data.timezone,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          displayName: parsed.data.displayName,
          timezone: parsed.data.timezone,
          updatedAt: new Date(),
        },
      })
      .returning();

    await logAuditEvent({
      userId,
      action: 'PROFILE_UPDATED',
      entityType: 'user_profile',
      entityId: userId,
      details: parsed.data,
    });

    return { profile: updated };
  })
  .patch('/risk-limits', async ({ body, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const parsed = RiskLimitsSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: 'Validation failed', details: parsed.error.flatten() };
    }

    const [updated] = await db
      .insert(userProfiles)
      .values({
        userId,
        riskLimits: parsed.data,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          riskLimits: parsed.data,
          updatedAt: new Date(),
        },
      })
      .returning();

    await logAuditEvent({
      userId,
      action: 'RISK_LIMITS_UPDATED',
      entityType: 'user_profile',
      entityId: userId,
      details: parsed.data,
    });

    return { profile: updated };
  });
