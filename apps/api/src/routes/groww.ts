import { Elysia } from 'elysia';

export const growwRoutes = new Elysia({ prefix: '/api/groww' })
  .post('/connect', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  })
  .get('/status', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  })
  .post('/sync', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  });
