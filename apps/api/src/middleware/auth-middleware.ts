import { Elysia } from 'elysia';
import { eq } from 'drizzle-orm';
import { auth } from '../auth';
import { db } from '../db';
import { userProfiles } from '../db/schema';
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
      let role = user?.role ?? null;
      if (!role && user?.id) {
        const [profile] = await db
          .select({ role: userProfiles.role })
          .from(userProfiles)
          .where(eq(userProfiles.userId, user.id))
          .limit(1);
        role = profile?.role ?? 'SUPER_ADMIN';
      }
      return {
        userId: user?.id ?? null,
        userRole: role ?? 'SUPER_ADMIN',
        sessionUser: user ? { ...user, role: role ?? 'SUPER_ADMIN' } : null,
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

/**
 * Guards a route to SUPER_ADMIN role only.
 * Usage: if (!requireRole(userRole, 'SUPER_ADMIN', set)) return { error: 'Forbidden' };
 */
export function requireRole(
  userRole: string | null,
  role: 'SUPER_ADMIN',
  set: { status?: number | string },
): boolean {
  if (userRole !== role) {
    set.status = 403;
    return false;
  }
  return true;
}

/**
 * Returns true if the authenticated user is SUPER_ADMIN.
 */
export function isSuperAdmin(userRole: string | null): boolean {
  return userRole === 'SUPER_ADMIN';
}

/**
 * Returns true if the authenticated user is in DEMO mode (read-only).
 */
export function isDemoUser(userRole: string | null): boolean {
  return userRole === 'DEMO';
}
