import { Elysia } from 'elysia';

export const strategyRoutes = new Elysia({ prefix: '/api/strategies' })
  .get('/', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  });
