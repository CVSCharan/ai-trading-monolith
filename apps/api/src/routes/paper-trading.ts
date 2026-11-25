import { Elysia } from 'elysia';

export const paperTradingRoutes = new Elysia({ prefix: '/api/paper' })
  .post('/start', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  })
  .post('/stop', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  })
  .get('/portfolio', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  })
  .get('/positions', ({ set }) => {
    set.status = 501;
    return { error: 'Not Implemented' };
  });
