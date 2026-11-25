import { Elysia } from 'elysia';

export const backtestRoutes = new Elysia({ prefix: '/api/backtest' })
  .post('/run', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  });
