// ============================================
// Audit Logs Route (S12-004)
// ============================================

import { Elysia, t } from 'elysia';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';

export const auditRoutes = new Elysia({ prefix: '/api/audit' })
  .use(authPlugin)
  .get(
    '/',
    async ({ query, userId, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

      const limit = Math.min(Math.max(Number(query.limit ?? 100), 1), 250);
      const actionFilter = (query.action ?? '').trim();

      const whereClause = actionFilter
        ? and(eq(auditLogs.userId, userId), ilike(auditLogs.action, `%${actionFilter}%`))
        : eq(auditLogs.userId, userId);

      const logs = await db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);

      return { logs };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        action: t.Optional(t.String()),
      }),
    },
  );
