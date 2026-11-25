import { Elysia } from 'elysia';
import { auth } from '../auth';
import { logger } from '../logger';

export interface AuthContext {
  userId: string | null;
  userRole: string | null;
  sessionUser: {
    id: string;
    email: string;
    name: string;
    role?: string;
  } | null;
}

/**
 * Resolves Better Auth session from request cookies/headers and attaches userId/role.
 */
export const authPlugin = new Elysia({ name: 'auth-plugin' }).derive(
  { as: 'global' },
  async ({ request }) => {
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user) {
        return { userId: null, userRole: null, sessionUser: null };
      }
      const user = session.user as AuthContext['sessionUser'];
      return {
        userId: user?.id ?? null,
        userRole: user?.role ?? 'viewer',
        sessionUser: user,
      };
    } catch (err) {
      logger.warn({ err }, 'Failed to resolve Better Auth session');
      return { userId: null, userRole: null, sessionUser: null };
    }
  }
);

export function requireAuth(userId: string | null, set: { status?: number | string }): userId is string {
  if (!userId) {
    set.status = 401;
    return false;
  }
  return true;
}
