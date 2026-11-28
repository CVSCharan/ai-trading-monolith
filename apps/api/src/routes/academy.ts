import { Elysia, t } from 'elysia';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { academyProgress } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';

export const academyRoutes = new Elysia({ prefix: '/api/academy' })
  .use(authPlugin)
  .get('/progress', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const items = await db
      .select()
      .from(academyProgress)
      .where(eq(academyProgress.userId, userId))
      .orderBy(desc(academyProgress.completedAt));

    return { items };
  })
  .post(
    '/complete',
    async ({ body, userId, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

      const [saved] = await db
        .insert(academyProgress)
        .values({
          userId,
          moduleId: body.moduleId,
          lessonId: body.lessonId,
          quizScore: body.quizScore ?? 100,
          quizAttempts: 1,
          completedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [academyProgress.userId, academyProgress.moduleId, academyProgress.lessonId],
          set: {
            quizScore: body.quizScore ?? 100,
            quizAttempts: sql`${academyProgress.quizAttempts} + 1`,
            completedAt: new Date(),
          },
        })
        .returning();

      return { item: saved };
    },
    {
      body: t.Object({
        moduleId: t.String({ minLength: 1, maxLength: 50 }),
        lessonId: t.String({ minLength: 1, maxLength: 50 }),
        quizScore: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
      }),
    }
  )
  .delete('/:moduleId/:lessonId', async ({ params, userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    await db
      .delete(academyProgress)
      .where(
        and(
          eq(academyProgress.userId, userId),
          eq(academyProgress.moduleId, params.moduleId),
          eq(academyProgress.lessonId, params.lessonId)
        )
      );

    return { reset: true };
  });
