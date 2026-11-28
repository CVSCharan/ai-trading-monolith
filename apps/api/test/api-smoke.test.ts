import { describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { tradeRoutes } from '../src/routes/trade';
import { marketDataRoutes } from '../src/routes/market-data';
import { enforceRateLimit } from '../src/middleware/rate-limit-middleware';

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
    // Isolated route testing enforceRateLimit without relying on active database socket
    const testApp = new Elysia().post('/api/auth/forgot-password-test', async ({ request, set }) => {
      const rl = await enforceRateLimit('auth-forgot-pwd-test', request, set, 3, 60_000);
      if (!rl.allowed) return { error: rl.error, retryAfterSec: rl.retryAfterSec };
      return { ok: true };
    });

    let lastStatus = 200;
    for (let i = 0; i < 4; i++) {
      const res = await testApp.handle(
        new Request('http://localhost/api/auth/forgot-password-test', {
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

