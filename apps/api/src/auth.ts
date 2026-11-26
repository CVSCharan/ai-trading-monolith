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
