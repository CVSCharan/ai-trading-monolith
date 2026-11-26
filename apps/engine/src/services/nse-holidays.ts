// ============================================
// NSE Holiday & Expiry Calendar Guard (S15-002)
// ============================================

import { getISTDateString } from '@groww-trading/shared';

export function getISTMinutesSinceMidnight(date: Date): number {
  const ist = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ist.getHours() * 60 + ist.getMinutes();
}

// Known NSE F&O trading holidays (YYYY-MM-DD IST)
const NSE_HOLIDAYS = new Set<string>([
  '2026-01-26', // Republic Day
  '2026-03-03', // Holi
  '2026-03-20', // Id-Ul-Fitr
  '2026-03-26', // Ram Navami
  '2026-03-31', // Mahavir Jayanti
  '2026-04-03', // Good Friday
  '2026-04-14', // Dr. Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day
  '2026-05-27', // Bakri Id
  '2026-06-26', // Muharram
  '2026-09-14', // Ganesh Chaturthi
  '2026-10-02', // Mahatma Gandhi Jayanti
  '2026-10-20', // Dussehra
  '2026-11-10', // Diwali Balipratipada
  '2026-11-24', // Gurunanak Jayanti
  '2026-12-25', // Christmas
]);

/** Returns true if the given date (in IST) is a weekday and not an NSE holiday. */
export function isNSETradingDay(date: Date = new Date()): boolean {
  const istStr = getISTDateString(date);
  if (NSE_HOLIDAYS.has(istStr)) return false;

  const day = new Date(`${istStr}T12:00:00+05:30`).getDay();
  return day !== 0 && day !== 6;
}

/**
 * Returns true on weekly expiry day (Thursday IST) at or after 14:30 IST,
 * when new entries should roll to next week's expiry rather than entering expiring contracts.
 */
export function isExpiryRolloverWindow(date: Date = new Date()): boolean {
  const istStr = getISTDateString(date);
  const day = new Date(`${istStr}T12:00:00+05:30`).getDay();
  if (day !== 4) return false; // Thursday
  return getISTMinutesSinceMidnight(date) >= 14 * 60 + 30;
}
