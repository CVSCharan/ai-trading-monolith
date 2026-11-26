// ============================================
// Better Auth Configuration
// ============================================

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { asc, eq } from 'drizzle-orm';
import { db } from './db/index';
import * as schema from './db/schema';
import { config } from './config';

export const MAX_ACTIVE_SESSIONS = 3;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),

  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days rolling expiry
    updateAge: 60 * 60, // Rotate / extend session every 1 hour on activity
  },

  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
    },
  },

  databaseHooks: {
    session: {
      create: {
        after: async (newSession) => {
          const active = await db
            .select({ id: schema.session.id })
            .from(schema.session)
            .where(eq(schema.session.userId, newSession.userId))
            .orderBy(asc(schema.session.createdAt));

          if (active.length > MAX_ACTIVE_SESSIONS) {
            const toEvict = active.slice(0, active.length - MAX_ACTIVE_SESSIONS);
            for (const old of toEvict) {
              await db.delete(schema.session).where(eq(schema.session.id, old.id));
            }
          }
        },
      },
    },
  },

  baseURL: config.betterAuthUrl,
  secret: config.betterAuthSecret,
  trustedOrigins: [config.frontendUrl, config.betterAuthUrl, 'http://localhost:4173'],
});

export const hasRole = (user: { role?: string }, role: string) => {
  return user.role === role;
};

export const isSuperAdmin = (user: { role?: string }) => hasRole(user, 'SUPER_ADMIN');
export const isDemo = (user: { role?: string }) => hasRole(user, 'DEMO');

// Legacy aliases
export const isOwner = (user: { role?: string }) => isSuperAdmin(user);
export const isViewer = (user: { role?: string }) => isDemo(user);
