import { Elysia } from 'elysia';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { engineHealth, engineState } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';

export const engineRoutes = new Elysia({ prefix: '/api/engine' })
  .use(authPlugin)
  .get('/health', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [latest] = await db
      .select()
      .from(engineHealth)
      .orderBy(desc(engineHealth.lastCheck))
      .limit(1);

    return { health: latest ?? null };
  })
  .get('/state', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const states = await db
      .select()
      .from(engineState)
      .where(eq(engineState.userId, userId));

    return { states };
  });
