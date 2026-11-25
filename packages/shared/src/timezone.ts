// ============================================
// Timezone Helper - All session math in Asia/Kolkata
// ============================================

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get current time in IST
 */
export function nowIST(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/**
 * Convert any date to IST (treats input as local time, converts to IST)
 */
export function toIST(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/**
 * Create a date representing the given IST time
 * Returns a Date object whose internal time is the UTC equivalent of the IST time
 *
 * Example: createISTDate(2024, 0, 1, 9, 15)
 *   -> returns Date representing 2024-01-01T03:45:00.000Z (which is 09:15 IST)
 */
export function createISTDate(
  year: number,
  month: number, // 0-11
  day: number,
  hours: number,
  minutes: number,
  seconds: number = 0,
  ms: number = 0
): Date {
  // Convert IST to UTC by subtracting 5.5 hours
  const utcHour = hours - 5;
  const utcMin = minutes - 30;
  let finalHour = utcHour;
  let finalMin = utcMin;

  if (finalMin < 0) {
    finalMin += 60;
    finalHour -= 1;
  }
  if (finalHour < 0) {
    finalHour += 24;
    // Note: day rollback not handled for simplicity
  }

  return new Date(Date.UTC(year, month, day, finalHour, finalMin, seconds, ms));
}

/**
 * Create a date representing the given UTC time
 */
export function createUTCDate(
  year: number,
  month: number, // 0-11
  day: number,
  hours: number,
  minutes: number,
  seconds: number = 0,
  ms: number = 0
): Date {
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds, ms));
}

/**
 * Get minutes since midnight in IST for a date that's ALREADY in IST representation
 * (i.e., created by createISTDate)
 */
export function getMinutesIST(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Get minutes since midnight in IST for a date in UTC/local time
 * Converts to IST first
 */
export function getMinutesISTFromUTC(date: Date): number {
  const ist = toIST(date);
  return ist.getHours() * 60 + ist.getMinutes();
}

/**
 * Get IST date string (YYYY-MM-DD)
 */
export function getISTDateString(date: Date): string {
  const ist = toIST(date);
  const isoString = ist.toISOString();
  const parts = isoString.split('T');
  return parts[0] ?? '';
}

/**
 * Get IST time string (HH:mm)
 */
export function getISTTimeString(date: Date): string {
  const ist = toIST(date);
  return ist.toTimeString().slice(0, 5);
}

/**
 * Check if time is within market hours (09:15-15:30 IST)
 * Input should be a date in UTC/local time
 */
export function isMarketHours(date: Date): boolean {
  const minutes = getMinutesISTFromUTC(date);
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

/**
 * Check if time is within entry window
 * Entry window gates ENTRIES only, not exits
 * Half-open interval [start, end)
 */
export function isInEntryWindow(
  date: Date,
  windowStart: string,  // "HH:mm"
  windowEnd: string,
  blockedPeriods: string[] = []
): boolean {
  const minutes = getMinutesISTFromUTC(date);

  const startParts = windowStart.split(':');
  const startH = Number(startParts[0] ?? '0');
  const startM = Number(startParts[1] ?? '0');
  const endParts = windowEnd.split(':');
  const endH = Number(endParts[0] ?? '0');
  const endM = Number(endParts[1] ?? '0');
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  if (minutes < startMin || minutes >= endMin) {
    return false;
  }

  for (const period of blockedPeriods) {
    const parts = period.split('-');
    const blockStart = parts[0] ?? '';
    const blockEnd = parts[1] ?? '';
    const bsParts = blockStart.split(':');
    const bsH = Number(bsParts[0] ?? '0');
    const bsM = Number(bsParts[1] ?? '0');
    const beParts = blockEnd.split(':');
    const beH = Number(beParts[0] ?? '0');
    const beM = Number(beParts[1] ?? '0');
    const blockStartMin = bsH * 60 + bsM;
    const blockEndMin = beH * 60 + beM;

    if (minutes >= blockStartMin && minutes < blockEndMin) {
      return false;
    }
  }

  return true;
}

/**
 * Check if time is at or past square-off time (15:00 IST)
 */
export function isSquareOffTime(date: Date, squareOffTime: string = '15:00'): boolean {
  const minutes = getMinutesISTFromUTC(date);
  const sqParts = squareOffTime.split(':');
  const sqH = Number(sqParts[0] ?? '0');
  const sqM = Number(sqParts[1] ?? '0');
  const sqMinutes = sqH * 60 + sqM;
  return minutes >= sqMinutes;
}

/**
 * Check if in closing period (15:15-15:30)
 */
export function isInClosingPeriod(date: Date): boolean {
  const minutes = getMinutesISTFromUTC(date);
  return minutes >= 15 * 60 + 15 && minutes <= 15 * 60 + 30;
}

/**
 * Get aligned bar OPEN time in IST for a given timestamp
 * Bars aligned to 09:15 market open
 * Input: timestamp in UTC/local time
 * Returns: Date in IST representation (created by createISTDate)
 */
export function getAlignedBarTimeIST(
  timestamp: Date,
  timeframeMinutes: number
): Date {
  const ist = toIST(timestamp);
  const totalMinutes = getMinutesIST(ist) - (9 * 60 + 15);

  if (totalMinutes < 0) {
    return createISTDate(
      ist.getFullYear(), ist.getMonth(), ist.getDate(),
      9, 15
    );
  }

  const alignedIndex = Math.floor(totalMinutes / timeframeMinutes);
  const alignedMinutes = alignedIndex * timeframeMinutes;
  const hour = Math.floor((9 * 60 + 15 + alignedMinutes) / 60);
  const minute = (9 * 60 + 15 + alignedMinutes) % 60;

  return createISTDate(
    ist.getFullYear(), ist.getMonth(), ist.getDate(),
    hour, minute
  );
}

/**
 * Get bar CLOSE time from bar OPEN time
 * Input: barOpen in IST representation (from createISTDate)
 * Returns: Date in IST representation
 */
export function getBarCloseTimeIST(barOpen: Date, timeframeMinutes: number): Date {
  const close = new Date(barOpen);
  close.setMinutes(close.getMinutes() + timeframeMinutes);
  return close;
}

/**
 * Get next 1m candle open time in IST
 */
export function getNextMinuteOpenIST(timestamp: Date): Date {
  const next = new Date(toIST(timestamp));
  next.setMinutes(next.getMinutes() + 1, 0, 0);
  return next;
}

/**
 * Parse HH:mm string to minutes since midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = Number(parts[0] ?? '0');
  const minutes = Number(parts[1] ?? '0');
  return hours * 60 + minutes;
}

/**
 * Format minutes since midnight to HH:mm
 */
export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Check if date is a trading day (Mon-Fri, not a holiday)
 * Note: Holiday list should be fetched from NSE calendar
 */
export function isTradingDay(date: Date): boolean {
  const ist = toIST(date);
  const day = ist.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Get market open time for a given date
 */
export function getMarketOpen(date: Date): Date {
  const ist = toIST(date);
  return createISTDate(
    ist.getFullYear(), ist.getMonth(), ist.getDate(),
    9, 15
  );
}

/**
 * Get market close time for a given date
 */
export function getMarketClose(date: Date): Date {
  const ist = toIST(date);
  return createISTDate(
    ist.getFullYear(), ist.getMonth(), ist.getDate(),
    15, 30
  );
}