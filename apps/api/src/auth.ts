// ============================================
// Better Auth Configuration
// ============================================

import { defineBetterAuth } from '@better-auth/express';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import type { DrizzleDB } from 'better-auth/db';
import { db } from './db/index';
import { user, userProfiles, accounts, sessions, verification, passkeys } from './db/schema';
import type { BetterAuthInstance } from '@better-auth/types';

// Initialize Better Auth
export const auth = betterAuth({
  // Database adapter
  database: drizzleAdapter(db as unknown as DrizzleDB, {
    provider: 'pg',
  }),

  // Email & Password
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,  // Disable auto-signin for security
  },

  // Session configuration
  session: {
    // Session cookie name
    cookieName: 'groww-trading-session',
    // Session TTL (14 days)
    exp: 60 * 60 * 24 * 14,
    // Refresh TTL
    refreshTokenExpirationExp: 60 * 60 * 24 * 30,
    // HTTP-only cookie
    cookieSameSite: 'lax' as const,
    cookieSecure: false,  // Set to true in production with HTTPS
  },

  // User configuration
  user: {
    additionalFields: {
      // Extend user with role and trading preferences
      role: {
        type: 'string',
        defaultValue: 'viewer',
      },
      // Trading preferences
      timezone: {
        type: 'string',
        defaultValue: 'Asia/Kolkata',
      },
      paperCapital: {
        type: 'number',
        defaultValue: 1000000,
      },
    },
    requiredFields: ['name', 'email'],
    autoRegister: false,  // Disable auto-registration - invite only
  },

  // Email configuration (minimal for internal use)
  verification: {
    enabled: false,  // Skip email verification for internal use
    autoSignInAfterVerification: false,
  },

  // 2FA (disabled for now, will enable for live trading)
  totp: {
    enabled: false,
  },

  // Social providers (disabled)
  socialProviders: {
    google: false,
    github: false,
    microsoft: false,
  },

  // Site URL
  // In production, set this to your Vercel URL
  websiteUrl: process.env.BETTER_AUTH_URL || 'http://localhost:3000',

  // Debug mode
  secret: process.env.BETTER_AUTH_SECRET || 'dev-secret-change-me',
});

// Export Express middleware and handler
export const authHandler = defineBetterAuth(auth);

// Type exports
export type { BetterAuthInstance };

// Helper functions
export const hasRole = (user: any, role: string) => {
  return user.role === role;
};

export const isOwner = (user: any) => hasRole(user, 'owner');
export const isViewer = (user: any) => hasRole(user, 'viewer');