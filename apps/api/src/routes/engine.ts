import { Elysia } from 'elysia';

export const engineRoutes = new Elysia({ prefix: '/api/engine' })
  .get('/health', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  })
  .get('/state', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  });
