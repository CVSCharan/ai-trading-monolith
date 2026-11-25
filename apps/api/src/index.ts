// ============================================
// API App - Elysia Entry Point
// ============================================

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { swagger } from '@elysiajs/swagger';
import { config } from './config';
import { logger } from './logger';
import { db } from './db';
import { seed } from './db/seed';
import { userRoutes } from './routes/user';
import { strategyRoutes } from './routes/strategy';
import { backtestRoutes } from './routes/backtest';
import { tradeRoutes } from './routes/trade';
import { marketDataRoutes } from './routes/market-data';
import { paperTradingRoutes } from './routes/paper-trading';
import { liveTradingRoutes } from './routes/live-trading';
import { growwRoutes } from './routes/groww';
import { engineRoutes } from './routes/engine';
import { auth } from './auth';

const app = new Elysia()
  .use(cors())
  .use(jwt({ name: 'auth', secret: config.betterAuthSecret }))
  .use(swagger({ path: '/api-docs' }))
  .use(userRoutes)
  .use(strategyRoutes)
  .use(backtestRoutes)
  .use(tradeRoutes)
  .use(marketDataRoutes)
  .use(paperTradingRoutes)
  .use(liveTradingRoutes)
  .use(growwRoutes)
  .use(engineRoutes)
  .all('/api/auth/*', ({ request }) => auth.handler(request))
  .get('/', () => ({ status: 'ok' }))
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .listen(config.port);

logger.info({ url: app.server?.hostname }, 'API app started');

// Seed database on startup
seed().catch((err) => {
  logger.error({ err }, 'Database seed failed');
});