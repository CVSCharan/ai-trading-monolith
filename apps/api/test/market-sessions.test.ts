process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/groww_trading';
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'dev-secret-change-me-in-prod-test';

import { describe, expect, test } from 'bun:test';
import { getMarketStatuses } from '@groww-trading/shared';

describe('Market Sessions Endpoint (S18-003)', () => {
  test('returns all 7 registered markets with valid statuses and timestamps', () => {
    const statuses = getMarketStatuses();
    expect(statuses.length).toBe(7);
    const ids = statuses.map((s) => s.id);
    expect(ids).toContain('NSE_EQUITY');
    expect(ids).toContain('NSE_FNO');
    expect(ids).toContain('BSE_EQUITY');
    expect(ids).toContain('CDS_INR');
    expect(ids).toContain('CDS_CROSS');
    expect(ids).toContain('MCX_AGRI');
    expect(ids).toContain('MCX_NON_AGRI');

    for (const session of statuses) {
      expect(['PRE_OPEN', 'OPEN', 'CLOSING_SOON', 'CLOSED']).toContain(session.status);
      expect(typeof session.openIST).toBe('string');
      expect(typeof session.closeIST).toBe('string');
      expect(typeof session.nextEvent).toBe('string');
    }
  });

  test('blocks unauthorized access to /api/market/sessions without session cookie', async () => {
    const { marketDataRoutes } = await import('../src/routes/market-data');
    const response = await marketDataRoutes.handle(
      new Request('http://localhost/api/market/sessions')
    );
    expect(response.status).toBe(401);
  });
});
