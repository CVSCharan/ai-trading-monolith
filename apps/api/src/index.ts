// ============================================
// API App - Elysia Entry Point
// ============================================

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { swagger } from '@elysiajs/swagger';
import { config } from './config';
import { logger } from './logger';
import { pgClient } from './db';
import { seed } from './db/seed';
import { authPlugin } from './middleware/auth-middleware';
import { createRateLimitPlugin } from './middleware/rate-limit-middleware';
import { wsManager, wsPlugin } from './services/ws-manager';
import { startBacktestWorker, stopBacktestWorker } from './services/backtest-runner';
import { userRoutes } from './routes/user';
import { strategyRoutes } from './routes/strategy';
import { backtestRoutes } from './routes/backtest';
import { tradeRoutes } from './routes/trade';
import { marketDataRoutes } from './routes/market-data';
import { paperTradingRoutes } from './routes/paper-trading';
import { liveTradingRoutes } from './routes/live-trading';
import { growwRoutes } from './routes/groww';
import { watchlistRoutes } from './routes/watchlist';
import { instrumentRoutes } from './routes/instruments';
import { engineRoutes } from './routes/engine';
import { auditRoutes } from './routes/audit';
import { authExtraRoutes } from './routes/auth-extra';
import { upstoxRoutes } from './routes/upstox';
import { newsRoutes } from './routes/news';
import { academyRoutes } from './routes/academy';
import { journalRoutes } from './routes/journal';
import { auth } from './auth';

const app = new Elysia()
  .derive(({ request, set }) => {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    set.headers['x-request-id'] = requestId;
    return { requestId };
  })
  .onError(({ code, error, requestId, request, set }) => {
    const url = new URL(request.url);
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (code === 'NOT_FOUND') {
      logger.warn({ code, requestId, method: request.method, path: url.pathname }, `Route not found (404): ${request.method} ${url.pathname}`);
    } else {
      logger.error({ code, requestId, method: request.method, path: url.pathname, err: error }, 'Unhandled API error');
    }
    if (!set.status || set.status === 200) {
      set.status = code === 'NOT_FOUND' ? 404 : code === 'VALIDATION' ? 400 : 500;
    }
    return {
      error: message,
      code,
      requestId,
    };
  })
  .use(cors({ origin: config.frontendUrl, credentials: true }))
  .use(jwt({ name: 'auth', secret: config.betterAuthSecret }))
  .use(swagger({ path: '/api-docs' }))
  .use(createRateLimitPlugin({ name: 'api-global', maxRequests: 100, windowMs: 60_000 }))
  .use(authPlugin)
  .use(wsPlugin)
  .use(userRoutes)
  .use(strategyRoutes)
  .use(backtestRoutes)
  .use(tradeRoutes)
  .use(marketDataRoutes)
  .use(paperTradingRoutes)
  .use(liveTradingRoutes)
  .use(growwRoutes)
  .use(watchlistRoutes)
  .use(instrumentRoutes)
  .use(upstoxRoutes)
  .use(engineRoutes)
  .use(auditRoutes)
  .use(authExtraRoutes)
  .use(newsRoutes)
  .use(academyRoutes)
  .use(journalRoutes)
  .all('/api/auth/*', ({ request }) => auth.handler(request))
  .get('/', () => ({ status: 'ok' }))
  .get('/health', async ({ set }) => {
    try {
      await pgClient`SELECT 1`;
      return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
    } catch (err) {
      logger.error({ err }, 'Database health check failed');
      set.status = 503;
      return { status: 'degraded', db: 'disconnected', timestamp: new Date().toISOString() };
    }
  })
  .get('/favicon.ico', ({ set }) => {
    set.status = 204;
    return '';
  })
  .listen(config.port);

logger.info({ port: config.port, url: app.server?.hostname }, 'API app started');

// Only seed database on startup if explicitly requested via SEED_ON_START=true
if (process.env['SEED_ON_START'] === 'true') {
  logger.info('SEED_ON_START=true detected; executing database seed...');
  seed().catch((err) => {
    logger.error({ err }, 'Database seed failed');
  });
}
void wsManager.startPostgresBridge();
startBacktestWorker();

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down API server...');
  stopBacktestWorker();
  app.stop();
  await pgClient.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection in API server (kept alive)');
});

process.on('uncaughtException', (err) => {
  const code = (err as { code?: string })?.code;
  if (code === 'CONNECTION_CLOSED' || code === 'ENOTFOUND' || code === 'ECONNRESET') {
    logger.warn({ err }, 'Transient DB/network socket error caught (kept alive)');
    return;
  }
  logger.fatal({ err }, 'Uncaught exception in API server');
  process.exit(1);
});
