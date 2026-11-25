import { db } from '../db';
import { userProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Server-side risk & mode gate enforced before paper/live order commands.
 */
export async function validateOrderRisk(
  userId: string,
  mode: 'paper' | 'live'
): Promise<RiskCheckResult> {
  if (mode === 'live' && process.env['ENABLE_LIVE_TRADING'] !== 'true') {
    return { allowed: false, reason: 'Live trading is disabled by server configuration' };
  }

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    return { allowed: false, reason: 'User trading profile not found' };
  }

  if (mode === 'live' && !profile.liveTradingEnabled) {
    return { allowed: false, reason: 'Live trading is not enabled for this user' };
  }

  const limits = (profile.riskLimits ?? {}) as {
    maxPositions?: number;
    maxDailyLossPct?: number;
  };
  if ((limits.maxPositions ?? 1) <= 0 || Number(limits.maxDailyLossPct ?? 1) <= 0) {
    return { allowed: false, reason: 'Invalid risk limits configured on user profile' };
  }

  return { allowed: true };
}
