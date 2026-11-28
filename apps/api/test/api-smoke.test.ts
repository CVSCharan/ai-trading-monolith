import { describe, expect, test } from 'bun:test';
import { tradeRoutes } from '../src/routes/trade';
import { marketDataRoutes } from '../src/routes/market-data';
import { authExtraRoutes } from '../src/routes/auth-extra';

describe('Control Plane & API Smoke Suite (GAP-07)', () => {
  test('blocks unauthorized access to /api/trades/recent without session cookie', async () => {
    const res = await tradeRoutes.handle(new Request('http://localhost/api/trades/recent'));
    expect(res.status).toBe(401);
  });

  test('blocks unauthorized access to /api/market/sessions without session cookie', async () => {
    const res = await marketDataRoutes.handle(new Request('http://localhost/api/market/sessions'));
    expect(res.status).toBe(401);
  });

  test('enforces strict rate limits on sensitive auth endpoints', async () => {
    // 3 requests allowed, 4th must return 429
    let lastStatus = 200;
    for (let i = 0; i < 4; i++) {
      const res = await authExtraRoutes.handle(
        new Request('http://localhost/api/auth/forgot-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '198.51.100.99',
          },
          body: JSON.stringify({ email: 'nonexistent-user@example.com' }),
        })
      );
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});
