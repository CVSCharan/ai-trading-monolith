import { Elysia } from 'elysia';

export const userRoutes = new Elysia({ prefix: '/api/user' })
  .get('/profile', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  })
  .patch('/risk-limits', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  });
