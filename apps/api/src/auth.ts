// ============================================
// Better Auth Configuration
// ============================================

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/index';
import * as schema from './db/schema';
import { config } from './config';

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
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24,
  },

  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'viewer',
      },
      timezone: {
        type: 'string',
        defaultValue: 'Asia/Kolkata',
      },
      paperCapital: {
        type: 'number',
        defaultValue: 1000000,
      },
    },
  },

  baseURL: config.betterAuthUrl,
  secret: config.betterAuthSecret,
});

export const hasRole = (user: { role?: string }, role: string) => {
  return user.role === role;
};

export const isOwner = (user: { role?: string }) => hasRole(user, 'owner');
export const isViewer = (user: { role?: string }) => hasRole(user, 'viewer');
