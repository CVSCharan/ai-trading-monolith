import { Elysia } from 'elysia';

export const marketDataRoutes = new Elysia({ prefix: '/api/market' })
  .get('/candles/:symbol', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  });
