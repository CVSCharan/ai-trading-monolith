import { Elysia } from 'elysia';

export const tradeRoutes = new Elysia({ prefix: '/api/trades' })
  .get('/:id', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  });
