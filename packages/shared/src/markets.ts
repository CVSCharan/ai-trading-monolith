// ============================================
// Multi-Market Registry & Session Clocks
// ============================================

import { getMinutesISTFromUTC, toIST, parseTimeToMinutes, formatMinutesToTime } from './timezone';

export interface MarketDefinition {
  id: string;
  name: string;
  exchange: 'NSE' | 'BSE' | 'NSE/BSE' | 'MCX';
  segment: 'EQUITY' | 'FNO' | 'CDS' | 'COMMODITY';
  openIST: string; // HH:mm
  getCloseIST: (date?: Date) => string; // HH:mm (dynamic for MCX DST)
  description: string;
}

export type MarketSessionStatus = 'PRE_OPEN' | 'OPEN' | 'CLOSING_SOON' | 'CLOSED';

export interface MarketSessionInfo {
  id: string;
  name: string;
  exchange: string;
  segment: string;
  openIST: string;
  closeIST: string;
  isOpen: boolean;
  isTradingDay: boolean;
  status: MarketSessionStatus;
  minutesToOpen: number;
  minutesToClose: number;
  nextEvent: string;
}

export interface MarketAlertScheduleItem {
  marketId: string;
  marketName: string;
  eventType: 'MARKET_OPEN' | 'MARKET_CLOSING_SOON' | 'MARKET_CLOSED' | 'MARKET_POST_CLOSE';
  timeIST: string; // HH:mm
  cronExpr: string; // node-cron expression for Mon-Fri
  message: string;
}

/**
 * Check if the US is currently in Daylight Saving Time (EDT).
 * US DST runs from the 2nd Sunday in March to the 1st Sunday in November.
 * MCX Non-Agri trading closes at 23:30 IST during US DST, and 23:55 IST in US non-DST (winter).
 */
export function isUSDST(date: Date = new Date()): boolean {
  const year = date.getUTCFullYear();

  // 2nd Sunday in March at 02:00 EST (07:00 UTC)
  const marchFirst = new Date(Date.UTC(year, 2, 1));
  const marchFirstDay = marchFirst.getUTCDay();
  const firstSunMarch = marchFirstDay === 0 ? 1 : 1 + (7 - marchFirstDay);
  const secondSunMarch = firstSunMarch + 7;
  const dstStart = new Date(Date.UTC(year, 2, secondSunMarch, 7, 0, 0));

  // 1st Sunday in November at 02:00 EDT (06:00 UTC)
  const novFirst = new Date(Date.UTC(year, 10, 1));
  const novFirstDay = novFirst.getUTCDay();
  const firstSunNov = novFirstDay === 0 ? 1 : 1 + (7 - novFirstDay);
  const dstEnd = new Date(Date.UTC(year, 10, firstSunNov, 6, 0, 0));

  return date >= dstStart && date < dstEnd;
}

export const MARKETS: MarketDefinition[] = [
  {
    id: 'NSE_EQUITY',
    name: 'NSE Equity (Cash)',
    exchange: 'NSE',
    segment: 'EQUITY',
    openIST: '09:15',
    getCloseIST: () => '15:30',
    description: 'National Stock Exchange Cash & Equities session',
  },
  {
    id: 'NSE_FNO',
    name: 'NSE F&O',
    exchange: 'NSE',
    segment: 'FNO',
    openIST: '09:15',
    getCloseIST: () => '15:30',
    description: 'NSE Equity Indices and Stock Futures & Options',
  },
  {
    id: 'BSE_EQUITY',
    name: 'BSE Equity (Cash)',
    exchange: 'BSE',
    segment: 'EQUITY',
    openIST: '09:15',
    getCloseIST: () => '15:30',
    description: 'Bombay Stock Exchange Cash & Equities session',
  },
  {
    id: 'CDS_INR',
    name: 'Currency (INR Pairs)',
    exchange: 'NSE/BSE',
    segment: 'CDS',
    openIST: '09:00',
    getCloseIST: () => '17:00',
    description: 'Currency Derivatives - USDINR, EURINR, GBPINR, JPYINR',
  },
  {
    id: 'CDS_CROSS',
    name: 'Currency (Cross Pairs)',
    exchange: 'NSE/BSE',
    segment: 'CDS',
    openIST: '09:00',
    getCloseIST: () => '19:30',
    description: 'Cross-Currency Derivatives - EURUSD, GBPUSD, USDJPY',
  },
  {
    id: 'MCX_AGRI',
    name: 'MCX Commodity (Agri)',
    exchange: 'MCX',
    segment: 'COMMODITY',
    openIST: '09:00',
    getCloseIST: () => '17:00',
    description: 'MCX Agricultural Commodities (Cotton, Cardamom, etc.)',
  },
  {
    id: 'MCX_NON_AGRI',
    name: 'MCX Commodity (Non-Agri)',
    exchange: 'MCX',
    segment: 'COMMODITY',
    openIST: '09:00',
    getCloseIST: (date = new Date()) => (isUSDST(date) ? '23:30' : '23:55'),
    description: 'MCX Bullion (Gold/Silver), Crude Oil, Natural Gas & Base Metals',
  },
];

/**
 * Compute the live market session status for all registered markets.
 */
export function getMarketStatuses(now: Date = new Date()): MarketSessionInfo[] {
  const ist = toIST(now);
  const day = ist.getDay();
  const isWeekend = day === 0 || day === 6;
  const currentMinutes = ist.getHours() * 60 + ist.getMinutes();

  return MARKETS.map((m) => {
    const closeIST = m.getCloseIST(now);
    const openMin = parseTimeToMinutes(m.openIST);
    const closeMin = parseTimeToMinutes(closeIST);

    if (isWeekend) {
      return {
        id: m.id,
        name: m.name,
        exchange: m.exchange,
        segment: m.segment,
        openIST: m.openIST,
        closeIST,
        isOpen: false,
        isTradingDay: false,
        status: 'CLOSED',
        minutesToOpen: 0,
        minutesToClose: 0,
        nextEvent: 'Weekend - Markets Closed',
      };
    }

    if (currentMinutes < openMin) {
      const minutesToOpen = openMin - currentMinutes;
      const isPreOpenWindow = minutesToOpen <= 15;
      return {
        id: m.id,
        name: m.name,
        exchange: m.exchange,
        segment: m.segment,
        openIST: m.openIST,
        closeIST,
        isOpen: false,
        isTradingDay: true,
        status: isPreOpenWindow ? 'PRE_OPEN' : 'CLOSED',
        minutesToOpen,
        minutesToClose: 0,
        nextEvent: `Opens in ${minutesToOpen > 60 ? `${Math.floor(minutesToOpen / 60)}h ${minutesToOpen % 60}m` : `${minutesToOpen}m`}`,
      };
    }

    if (currentMinutes >= openMin && currentMinutes < closeMin) {
      const minutesToClose = closeMin - currentMinutes;
      const isClosingSoon = minutesToClose <= 10;
      return {
        id: m.id,
        name: m.name,
        exchange: m.exchange,
        segment: m.segment,
        openIST: m.openIST,
        closeIST,
        isOpen: true,
        isTradingDay: true,
        status: isClosingSoon ? 'CLOSING_SOON' : 'OPEN',
        minutesToOpen: 0,
        minutesToClose,
        nextEvent: isClosingSoon
          ? `CLOSING SOON: Closes in ${minutesToClose}m`
          : `Closes in ${minutesToClose > 60 ? `${Math.floor(minutesToClose / 60)}h ${minutesToClose % 60}m` : `${minutesToClose}m`}`,
      };
    }

    return {
      id: m.id,
      name: m.name,
      exchange: m.exchange,
      segment: m.segment,
      openIST: m.openIST,
      closeIST,
      isOpen: false,
      isTradingDay: true,
      status: 'CLOSED',
      minutesToOpen: 0,
      minutesToClose: 0,
      nextEvent: 'Closed for the day',
    };
  });
}

/**
 * Generate alert schedules for open, 10-min pre-close, close, and 10-min post-close.
 */
export function getMarketAlertSchedules(now: Date = new Date()): MarketAlertScheduleItem[] {
  const items: MarketAlertScheduleItem[] = [];

  for (const m of MARKETS) {
    const openMin = parseTimeToMinutes(m.openIST);
    const closeIST = m.getCloseIST(now);
    const closeMin = parseTimeToMinutes(closeIST);

    // 1. Market Open
    const openCron = `${openMin % 60} ${Math.floor(openMin / 60)} * * 1-5`;
    items.push({
      marketId: m.id,
      marketName: m.name,
      eventType: 'MARKET_OPEN',
      timeIST: m.openIST,
      cronExpr: openCron,
      message: `🔔 Market OPEN: ${m.name} (${m.exchange}) is now open for trading (${m.openIST} IST).`,
    });

    // 2. 10 mins before close
    const preCloseMin = closeMin - 10;
    const preCloseTime = formatMinutesToTime(preCloseMin);
    const preCloseCron = `${preCloseMin % 60} ${Math.floor(preCloseMin / 60)} * * 1-5`;
    items.push({
      marketId: m.id,
      marketName: m.name,
      eventType: 'MARKET_CLOSING_SOON',
      timeIST: preCloseTime,
      cronExpr: preCloseCron,
      message: `⚠️ Closing in 10 mins: ${m.name} closes at ${closeIST} IST. Review open intraday positions and square-off rules.`,
    });

    // 3. Market Close
    const closeCron = `${closeMin % 60} ${Math.floor(closeMin / 60)} * * 1-5`;
    items.push({
      marketId: m.id,
      marketName: m.name,
      eventType: 'MARKET_CLOSED',
      timeIST: closeIST,
      cronExpr: closeCron,
      message: `🛑 Market CLOSED: ${m.name} (${m.exchange}) regular trading session has ended (${closeIST} IST).`,
    });

    // 4. 10 mins after close
    const postCloseMin = (closeMin + 10) % (24 * 60);
    const postCloseTime = formatMinutesToTime(postCloseMin);
    const postCloseCron = `${postCloseMin % 60} ${Math.floor(postCloseMin / 60)} * * 1-5`;
    items.push({
      marketId: m.id,
      marketName: m.name,
      eventType: 'MARKET_POST_CLOSE',
      timeIST: postCloseTime,
      cronExpr: postCloseCron,
      message: `📊 Post-Market Wrap: ${m.name} closed 10 mins ago (${postCloseTime} IST). Reconciliations & EOD tasks initiated.`,
    });
  }

  return items;
}
