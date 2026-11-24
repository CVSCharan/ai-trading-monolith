// ============================================
// API App - Elysia Entry Point
// ============================================

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { swagger } from '@elysiajs/swagger';
import { db } from './db';
import { seed } from './db/seed';
import { userRoutes } from './routes/user';
import { strategyRoutes } from './routes/strategy';
import { backtestRoutes } from './routes/backtest';
import { tradeRoutes } from './routes/trade';
import { marketDataRoutes } from './routes/market-data';
import { auth } from './auth';

const app = new Elysia()
  .use(cors())
  .use(jwt({ name: 'auth' }))
  .use(swagger({ path: '/api-docs' }))
  .use(userRoutes)
  .use(strategyRoutes)
  .use(backtestRoutes)
  .use(tradeRoutes)
  .use(marketDataRoutes)
  .use(auth)
  .get('/', () => ({ status: 'ok' }))
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .listen(config.port);

logger.info({ url: app.server?.hostname }, 'API app started');

// Seed database on startup
seed().catch((err) => {
  logger.error({ err }, 'Database seed failed');
});