import { describe, expect, it } from 'bun:test';
import {
  MARKETS,
  getMarketStatuses,
  getMarketAlertSchedules,
  isUSDST,
} from '../src/markets';
import { createISTDate } from '../src/timezone';

describe('Multi-Market Registry & Session Clocks', () => {
  it('registers all 7 market segments across NSE, BSE, and MCX', () => {
    expect(MARKETS.length).toBe(7);
    const ids = MARKETS.map((m) => m.id);
    expect(ids).toContain('NSE_EQUITY');
    expect(ids).toContain('NSE_FNO');
    expect(ids).toContain('BSE_EQUITY');
    expect(ids).toContain('CDS_INR');
    expect(ids).toContain('CDS_CROSS');
    expect(ids).toContain('MCX_AGRI');
    expect(ids).toContain('MCX_NON_AGRI');
  });

  it('correctly detects US Daylight Saving Time (summer vs winter)', () => {
    // July 15 is in US DST (summer)
    const summerDate = new Date('2024-07-15T12:00:00Z');
    expect(isUSDST(summerDate)).toBe(true);

    // January 15 is standard time (winter)
    const winterDate = new Date('2024-01-15T12:00:00Z');
    expect(isUSDST(winterDate)).toBe(false);

    // MCX Non-Agri adjusts close time accordingly
    const mcxNonAgri = MARKETS.find((m) => m.id === 'MCX_NON_AGRI')!;
    expect(mcxNonAgri.getCloseIST(summerDate)).toBe('23:30');
    expect(mcxNonAgri.getCloseIST(winterDate)).toBe('23:55');
  });

  it('computes market status correctly during active trading hours (e.g. 11:30 IST on a Wednesday)', () => {
    // 2024-05-15 is a Wednesday, 11:30 IST
    const midDay = createISTDate(2024, 4, 15, 11, 30);
    const statuses = getMarketStatuses(midDay);
    expect(statuses.length).toBe(7);

    const nseEq = statuses.find((s) => s.id === 'NSE_EQUITY')!;
    expect(nseEq.isOpen).toBe(true);
    expect(nseEq.status).toBe('OPEN');
    expect(nseEq.minutesToClose).toBe(4 * 60); // 11:30 to 15:30 = 240 mins
  });

  it('flags CLOSING_SOON when within 10 minutes of market close', () => {
    // Wednesday 15:25 IST (5 mins before NSE close)
    const nearClose = createISTDate(2024, 4, 15, 15, 25);
    const statuses = getMarketStatuses(nearClose);

    const nseEq = statuses.find((s) => s.id === 'NSE_EQUITY')!;
    expect(nseEq.isOpen).toBe(true);
    expect(nseEq.status).toBe('CLOSING_SOON');
    expect(nseEq.minutesToClose).toBe(5);
    expect(nseEq.nextEvent).toContain('CLOSING SOON: Closes in 5m');
  });

  it('marks markets closed and computes pre-open window accurately', () => {
    // Wednesday 09:05 IST (10 mins before NSE open, within pre-open)
    const preOpenTime = createISTDate(2024, 4, 15, 9, 5);
    const statuses = getMarketStatuses(preOpenTime);

    const nseEq = statuses.find((s) => s.id === 'NSE_EQUITY')!;
    expect(nseEq.isOpen).toBe(false);
    expect(nseEq.status).toBe('PRE_OPEN');
    expect(nseEq.minutesToOpen).toBe(10);

    // Wednesday 07:00 IST (well before pre-open)
    const earlyMorning = createISTDate(2024, 4, 15, 7, 0);
    const morningStatuses = getMarketStatuses(earlyMorning);
    const nseEqEarly = morningStatuses.find((s) => s.id === 'NSE_EQUITY')!;
    expect(nseEqEarly.status).toBe('CLOSED');
    expect(nseEqEarly.minutesToOpen).toBe(2 * 60 + 15);
  });

  it('marks all markets CLOSED on weekends', () => {
    // 2024-05-18 is a Saturday
    const weekendDate = createISTDate(2024, 4, 18, 12, 0);
    const statuses = getMarketStatuses(weekendDate);
    for (const s of statuses) {
      expect(s.isOpen).toBe(false);
      expect(s.isTradingDay).toBe(false);
      expect(s.status).toBe('CLOSED');
      expect(s.nextEvent).toContain('Weekend');
    }
  });

  it('generates 4 lifecycle alert schedules for each registered market', () => {
    const schedules = getMarketAlertSchedules();
    expect(schedules.length).toBe(7 * 4); // 28 total alert cron items

    const openAlerts = schedules.filter((s) => s.eventType === 'MARKET_OPEN');
    const closingSoonAlerts = schedules.filter((s) => s.eventType === 'MARKET_CLOSING_SOON');
    const closedAlerts = schedules.filter((s) => s.eventType === 'MARKET_CLOSED');
    const postCloseAlerts = schedules.filter((s) => s.eventType === 'MARKET_POST_CLOSE');

    expect(openAlerts.length).toBe(7);
    expect(closingSoonAlerts.length).toBe(7);
    expect(closedAlerts.length).toBe(7);
    expect(postCloseAlerts.length).toBe(7);

    const nseOpen = openAlerts.find((s) => s.marketId === 'NSE_EQUITY')!;
    expect(nseOpen.timeIST).toBe('09:15');
    expect(nseOpen.cronExpr).toBe('15 9 * * 1-5');

    const nseClosingSoon = closingSoonAlerts.find((s) => s.marketId === 'NSE_EQUITY')!;
    expect(nseClosingSoon.timeIST).toBe('15:20');
    expect(nseClosingSoon.cronExpr).toBe('20 15 * * 1-5');

    const nseClose = closedAlerts.find((s) => s.marketId === 'NSE_EQUITY')!;
    expect(nseClose.timeIST).toBe('15:30');
    expect(nseClose.cronExpr).toBe('30 15 * * 1-5');

    const nsePostClose = postCloseAlerts.find((s) => s.marketId === 'NSE_EQUITY')!;
    expect(nsePostClose.timeIST).toBe('15:40');
    expect(nsePostClose.cronExpr).toBe('40 15 * * 1-5');
  });
});
