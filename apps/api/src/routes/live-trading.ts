import { Elysia } from 'elysia';

export const liveTradingRoutes = new Elysia({ prefix: '/api/live' })
  .post('/enable', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  })
  .post('/emergency-stop', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  })
  .get('/orders', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  })
  .get('/positions', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  });
