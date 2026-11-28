import { eq } from 'drizzle-orm';
import { getISTDateString, getISTTimeString, isTradingDay } from '@groww-trading/shared';
import { db } from '../db';
import { userProfiles } from '../db/schema';
import { logger } from '../logger';
import { refreshWatchlistNews } from './news-service';

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
const executedSlots = new Set<string>();

async function runScheduledNewsSync(slotName: string): Promise<void> {
  try {
    const admins = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(eq(userProfiles.role, 'SUPER_ADMIN'));

    for (const { userId } of admins) {
      await refreshWatchlistNews(userId);
    }
    logger.info({ slotName, users: admins.length }, 'Scheduled Market Pulse news sync complete');
  } catch (err) {
    logger.error({ err, slotName }, 'Scheduled Market Pulse news sync failed');
  }
}

export function startNewsScheduler(): void {
  if (schedulerTimer) return;

  schedulerTimer = setInterval(() => {
    const now = new Date();
    if (!isTradingDay(now)) return;

    const istDate = getISTDateString(now);
    const hhmm = getISTTimeString(now);
    const [hhStr, mmStr] = hhmm.split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr);

    let slot: string | null = null;
    if (hhmm === '08:30') slot = 'PRE_MARKET';
    else if (hhmm === '15:35') slot = 'POST_MARKET';
    else if (hh >= 9 && hh <= 15 && (mm === 0 || mm === 30) && hhmm >= '09:30' && hhmm <= '15:00') {
      slot = `INTRADAY_${hhmm}`;
    }

    if (!slot) return;
    const key = `${istDate}:${slot}`;
    if (executedSlots.has(key)) return;
    executedSlots.add(key);

    // Keep set bounded across days
    if (executedSlots.size > 100) executedSlots.clear();
    void runScheduledNewsSync(slot);
  }, 30_000);

  logger.info('Market Pulse IST news scheduler started (08:30 pre-market, 30m intraday, 15:35 EOD)');
}

export function stopNewsScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
