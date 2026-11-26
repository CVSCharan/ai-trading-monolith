// ============================================
// Auth Extra Routes
// - GET  /api/auth/session        → current user + role
// - POST /api/auth/forgot-password → send reset email (SUPER_ADMIN only)
// - POST /api/auth/reset-password  → verify token + update password
// ============================================

import { Elysia, t } from 'elysia';
import { db } from '../db';
import { userProfiles } from '../db/schema';
import { user, account } from '../db/better-auth-schema';
import { authPlugin } from '../middleware/auth-middleware';
import { createRateLimitPlugin } from '../middleware/rate-limit-middleware';
import { logger } from '../logger';
import { eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { config } from '../config';

// ── JWT helpers for password reset ───────────────────────────────
const RESET_SECRET = config.betterAuthSecret;

async function signResetToken(userId: string, email: string): Promise<string> {
  const payload = { sub: userId, email, exp: Math.floor(Date.now() / 1000) + 3600, purpose: 'pwd_reset' };
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(RESET_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${data}.${sigB64}`;
}

async function verifyResetToken(token: string): Promise<{ sub: string; email: string; exp: number } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const data = `${header}.${body}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(RESET_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.purpose !== 'pwd_reset') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function sendResetEmail(email: string, resetUrl: string): Promise<void> {
  // If RESEND_API_KEY is set, use Resend; else log the URL for dev
  const resendKey = process.env['RESEND_API_KEY'];
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'noreply@aitrader.in',
          to: email,
          subject: 'AI Trader — Reset Your Password',
          html: `<p>Click below to reset your AI Trader password. This link expires in 1 hour.</p>
<p><a href="${resetUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Reset Password</a></p>
<p>If you didn't request this, ignore this email.</p>`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      logger.info({ email }, 'Password reset email sent via Resend');
    } catch (err) {
      logger.error({ err }, 'Failed to send reset email via Resend');
    }
  } else {
    // Dev fallback — log the link
    logger.info({ email, resetUrl }, '🔑 [DEV] Password reset link (no RESEND_API_KEY set)');
  }
}

export const authExtraRoutes = new Elysia({ prefix: '/api/auth' })
  .use(authPlugin)
  .use(createRateLimitPlugin({ name: 'auth-extra', maxRequests: 20, windowMs: 60_000 }))

  // ── GET /api/auth/session ─────────────────────────────────────
  .get('/session', async ({ userId, userRole, sessionUser, set }) => {
    if (!userId || !sessionUser) {
      set.status = 401;
      return { error: 'Not authenticated' };
    }
    const [profile] = await db
      .select({ role: userProfiles.role, timezone: userProfiles.timezone })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    return {
      user: {
        id: userId,
        email: sessionUser.email,
        name: sessionUser.name,
        role: profile?.role ?? userRole ?? 'SUPER_ADMIN',
      },
    };
  })

  // ── POST /api/auth/forgot-password ───────────────────────────
  .post(
    '/forgot-password',
    async ({ body, set }) => {
      const { email } = body as { email: string };

      // Look up the user
      const [found] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.email, email)).limit(1);
      if (!found) {
        // Don't reveal whether email exists
        return { message: 'If that email is registered, a reset link has been sent.' };
      }

      // Check if DEMO — block reset
      const [profile] = await db
        .select({ role: userProfiles.role })
        .from(userProfiles)
        .where(eq(userProfiles.userId, found.id))
        .limit(1);

      if (profile?.role === 'DEMO') {
        set.status = 403;
        return { error: 'Password reset is not available for the demo account.' };
      }

      const token = await signResetToken(found.id, found.email);
      const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

      await sendResetEmail(found.email, resetUrl);
      return { message: 'If that email is registered, a reset link has been sent.' };
    },
    { body: t.Object({ email: t.String({ format: 'email' }) }) },
  )

  // ── POST /api/auth/reset-password ────────────────────────────
  .post(
    '/reset-password',
    async ({ body, set }) => {
      const { token, password } = body as { token: string; password: string };

      const payload = await verifyResetToken(token);
      if (!payload) {
        set.status = 400;
        return { error: 'Invalid or expired reset token.' };
      }

      // Block DEMO
      const [profile] = await db
        .select({ role: userProfiles.role })
        .from(userProfiles)
        .where(eq(userProfiles.userId, payload.sub))
        .limit(1);

      if (profile?.role === 'DEMO') {
        set.status = 403;
        return { error: 'Password reset is not available for the demo account.' };
      }

      const hashedPw = await hashPassword(password);

      // Update the credential record (Better Auth credential provider)
      await db
        .update(account)
        .set({ password: hashedPw, updatedAt: new Date() })
        .where(eq(account.userId, payload.sub));

      logger.info({ userId: payload.sub }, 'Password reset successful');
      return { message: 'Password updated successfully. Please log in.' };
    },
    {
      body: t.Object({
        token: t.String(),
        password: t.String({ minLength: 8, maxLength: 128 }),
      }),
    },
  );
