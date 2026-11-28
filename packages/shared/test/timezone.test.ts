import { describe, expect, test } from 'bun:test';
import {
  createISTDate,
  getISTDateString,
  getISTTimeString,
  getMinutesISTFromUTC,
  isTradingDay,
} from '../src/timezone';

describe('IST Timezone Helpers (GAP-24)', () => {
  test('createISTDate handles 00:00-05:29 IST day rollback accurately', () => {
    // 2026-01-02 00:15 IST === 2026-01-01 18:45 UTC
    const dt = createISTDate(2026, 0, 2, 0, 15);
    expect(dt.toISOString()).toBe('2026-01-01T18:45:00.000Z');
    expect(getISTDateString(dt)).toBe('2026-01-02');
    expect(getISTTimeString(dt)).toBe('00:15');
    expect(getMinutesISTFromUTC(dt)).toBe(15);
  });

  test('getISTDateString and getISTTimeString work at 05:29 IST and 23:55 IST', () => {
    const early = new Date('2026-03-14T23:59:00.000Z'); // 2026-03-15 05:29 IST (Sunday)
    expect(getISTDateString(early)).toBe('2026-03-15');
    expect(getISTTimeString(early)).toBe('05:29');
    expect(isTradingDay(early)).toBe(false);

    const late = new Date('2026-03-16T18:25:00.000Z'); // 2026-03-16 23:55 IST (Monday)
    expect(getISTDateString(late)).toBe('2026-03-16');
    expect(getISTTimeString(late)).toBe('23:55');
    expect(isTradingDay(late)).toBe(true);
  });
});
