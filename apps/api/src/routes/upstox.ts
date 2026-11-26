// ============================================
// Upstox Routes (Analytics Token + OAuth v3)
// ============================================

import { Elysia, t } from 'elysia';
import { config } from '../config';
import { authPlugin, requireAuth, requireRole } from '../middleware/auth-middleware';
import { createRateLimitPlugin } from '../middleware/rate-limit-middleware';
import { UpstoxClient } from '@groww-trading/shared';

function maskSecret(val?: string): string | null {
  if (!val) return null;
  if (val.length <= 8) return '****';
  return `${val.slice(0, 4)}…${val.slice(-4)}`;
}

export const upstoxRoutes = new Elysia({ prefix: '/api/upstox' })
  .use(authPlugin)
  .use(createRateLimitPlugin({ name: 'upstox', maxRequests: 30, windowMs: 60_000 }))

  // ── GET /api/upstox/status ────────────────────────────────────
  .get('/status', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const analyticsConfigured = Boolean(config.upstox.analyticsToken);
    const accessConfigured = Boolean(config.upstox.accessToken);
    const oauthConfigured = Boolean(config.upstox.apiKey && config.upstox.apiSecret);

    return {
      analyticsConnected: analyticsConfigured,
      tradingConnected: accessConfigured,
      oauthConfigured,
      maskedAnalyticsToken: maskSecret(config.upstox.analyticsToken),
      maskedAccessToken: maskSecret(config.upstox.accessToken),
      algoName: config.upstox.algoName ?? null,
      activeDataBroker: config.activeDataBroker,
      activeExecutionBroker: config.activeExecutionBroker,
    };
  })

  // ── GET /api/upstox/option-chain ──────────────────────────────
  .get(
    '/option-chain',
    async ({ query, userId, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

      try {
        const client = new UpstoxClient({
          analyticsToken: config.upstox.analyticsToken,
          accessToken: config.upstox.accessToken,
        });
        const chain = await client.getOptionChain({
          instrumentKey: query.instrumentKey,
          expiryDate: query.expiryDate,
        });
        return { instrumentKey: query.instrumentKey, expiryDate: query.expiryDate, rows: chain };
      } catch (err) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : 'Failed to fetch Upstox option chain' };
      }
    },
    {
      query: t.Object({
        instrumentKey: t.String({ default: 'NSE_INDEX|Nifty 50' }),
        expiryDate: t.String(),
      }),
    },
  )

  // ── GET /api/upstox/candles ───────────────────────────────────
  .get(
    '/candles',
    async ({ query, userId, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

      try {
        const client = new UpstoxClient({
          analyticsToken: config.upstox.analyticsToken,
          accessToken: config.upstox.accessToken,
        });
        const candles = await client.getHistoricalCandles({
          symbol: query.instrumentKey,
          interval: query.interval as '1m' | '5m' | '15m' | '30m' | '1d',
          fromDate: query.fromDate,
          toDate: query.toDate,
        });
        return { instrumentKey: query.instrumentKey, interval: query.interval, candles };
      } catch (err) {
        set.status = 400;
        return { error: err instanceof Error ? err.message : 'Failed to fetch Upstox candles' };
      }
    },
    {
      query: t.Object({
        instrumentKey: t.String({ default: 'NSE_INDEX|Nifty 50' }),
        interval: t.Union([t.Literal('1m'), t.Literal('5m'), t.Literal('15m'), t.Literal('30m'), t.Literal('1d')], {
          default: '15m',
        }),
        fromDate: t.String(),
        toDate: t.String(),
      }),
    },
  )

  // ── GET /api/upstox/ip (SUPER_ADMIN only) ─────────────────────
  .get('/ip', async ({ userId, userRole, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
    if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden: SUPER_ADMIN only' };

    try {
      const client = new UpstoxClient({
        analyticsToken: config.upstox.analyticsToken,
        accessToken: config.upstox.accessToken,
      });
      const ips = await client.getRegisteredStaticIps();
      return { ...ips, staticIpConfigured: Boolean(ips.primaryIp || ips.secondaryIp) };
    } catch (err) {
      set.status = 400;
      return { error: err instanceof Error ? err.message : 'Failed to fetch Upstox Static IPs' };
    }
  })

  // ── GET /api/upstox/callback (OAuth code exchange) ────────────
  .get(
    '/callback',
    async ({ query, userId, userRole, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
      if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden: SUPER_ADMIN only' };

      if (!config.upstox.apiKey || !config.upstox.apiSecret || !config.upstox.redirectUri) {
        set.status = 400;
        return { error: 'UPSTOX_API_KEY, UPSTOX_API_SECRET, and UPSTOX_REDIRECT_URI must be set in .env' };
      }

      const body = new URLSearchParams({
        code: query.code,
        client_id: config.upstox.apiKey,
        client_secret: config.upstox.apiSecret,
        redirect_uri: config.upstox.redirectUri,
        grant_type: 'authorization_code',
      });

      const res = await fetch('https://api.upstox.com/v2/login/authorization/token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!res.ok) {
        set.status = 400;
        return { error: 'Upstox OAuth token exchange failed' };
      }

      const data = (await res.json()) as { access_token?: string; user_id?: string };
      return {
        connected: Boolean(data.access_token),
        upstoxUserId: data.user_id ?? null,
        maskedAccessToken: maskSecret(data.access_token),
      };
    },
    { query: t.Object({ code: t.String() }) },
  );
