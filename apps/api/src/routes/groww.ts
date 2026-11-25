import { Elysia } from 'elysia';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { authenticator } from 'otplib';
import { db } from '../db';
import { growwCredentials } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';
import { createRateLimitPlugin } from '../middleware/rate-limit-middleware';
import { logAuditEvent } from '../middleware/audit-middleware';
import { encrypt, decrypt, getMasterKey } from '../utils/encryption';

const ConnectSchema = z.object({
  totpToken: z.string().min(10, 'TOTP Token is required'),
  totpSecret: z.string().min(8, 'Base32 TOTP Secret from QR is required'),
});

const GROWW_API_BASE_URL = process.env['GROWW_API_BASE_URL'] ?? 'https://api.groww.in';

export const growwRoutes = new Elysia({ prefix: '/api/groww' })
  .use(authPlugin)
  .use(createRateLimitPlugin({ name: 'groww-auth', maxRequests: 10, windowMs: 60_000 }))
  .post('/connect', async ({ body, userId, request, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const parsed = ConnectSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: 'Validation failed', details: parsed.error.flatten() };
    }

    const masterKey = getMasterKey();
    const apiKeyEncrypted = encrypt(parsed.data.totpToken, masterKey);
    const totpSecretEncrypted = encrypt(parsed.data.totpSecret, masterKey);

    await db
      .insert(growwCredentials)
      .values({
        userId,
        apiKeyEncrypted,
        apiSecretEncrypted: null,
        totpSecretEncrypted,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: growwCredentials.userId,
        set: {
          apiKeyEncrypted,
          apiSecretEncrypted: null,
          totpSecretEncrypted,
          accessTokenEncrypted: null,
          tokenExpiresAt: null,
          isActive: true,
          updatedAt: new Date(),
        },
      });

    await logAuditEvent({
      userId,
      action: 'GROWW_CREDENTIALS_UPDATED',
      entityType: 'groww_credentials',
      entityId: userId,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    });

    return { connected: true };
  })
  .get('/status', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [cred] = await db
      .select({
        isActive: growwCredentials.isActive,
        tokenExpiresAt: growwCredentials.tokenExpiresAt,
        lastRefreshAt: growwCredentials.lastRefreshAt,
        refreshCountToday: growwCredentials.refreshCountToday,
      })
      .from(growwCredentials)
      .where(eq(growwCredentials.userId, userId))
      .limit(1);

    const envToken = process.env['GROWW_TOTP_TOKEN'] ?? process.env['GROWW_API_KEY'];
    const envSecret = process.env['GROWW_TOTP_SECRET'];
    const hasEnv = Boolean(envToken && envSecret);

    if (!cred) {
      return {
        connected: hasEnv,
        isActive: hasEnv,
        source: hasEnv ? ('env' as const) : ('none' as const),
        envConfigured: hasEnv,
        maskedKey: envToken ? `${envToken.slice(0, 6)}••••${envToken.slice(-4)}` : null,
        tokenValid: false,
      };
    }

    return {
      connected: true,
      isActive: Boolean(cred.isActive),
      source: 'db' as const,
      envConfigured: hasEnv,
      maskedKey: envToken ? `${envToken.slice(0, 6)}••••${envToken.slice(-4)}` : 'DB-ENCRYPTED',
      tokenValid: Boolean(cred.tokenExpiresAt && cred.tokenExpiresAt > new Date()),
      tokenExpiresAt: cred.tokenExpiresAt,
      lastRefreshAt: cred.lastRefreshAt,
      refreshCountToday: cred.refreshCountToday ?? 0,
    };
  })
  .post('/sync', async ({ userId, request, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

    const [cred] = await db
      .select()
      .from(growwCredentials)
      .where(eq(growwCredentials.userId, userId))
      .limit(1);

    const masterKey = getMasterKey();
    let totpToken: string | undefined;
    let totpSecret: string | undefined;

    if (cred) {
      totpToken = decrypt(cred.apiKeyEncrypted, masterKey);
      totpSecret = decrypt(cred.totpSecretEncrypted, masterKey);
    } else {
      totpToken = process.env['GROWW_TOTP_TOKEN'] ?? process.env['GROWW_API_KEY'];
      totpSecret = process.env['GROWW_TOTP_SECRET'];
    }

    if (!totpToken || !totpSecret) {
      set.status = 404;
      return { error: 'Groww TOTP credentials not found in DB or .env' };
    }

    const totp = authenticator.generate(totpSecret);

    const response = await fetch(`${GROWW_API_BASE_URL}/v1/token/api/access`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${totpToken}`,
        'X-API-VERSION': '1.0',
      },
      body: JSON.stringify({ key_type: 'totp', totp }),
    });

    if (!response.ok) {
      set.status = 502;
      return { error: `Groww token sync failed: ${response.status} ${response.statusText}` };
    }

    const data = (await response.json()) as {
      access_token?: string;
      token?: string;
      expires_in?: number;
    };
    const accessToken = data.access_token ?? data.token;
    if (!accessToken) {
      set.status = 502;
      return { error: 'Groww response did not include an access token' };
    }

    const expiresAt = new Date(Date.now() + (data.expires_in ?? 12 * 3600) * 1000);
    const accessTokenEncrypted = encrypt(accessToken, masterKey);

    await db
      .insert(growwCredentials)
      .values({
        userId,
        apiKeyEncrypted: cred?.apiKeyEncrypted ?? encrypt(totpToken, masterKey),
        apiSecretEncrypted: null,
        totpSecretEncrypted: cred?.totpSecretEncrypted ?? encrypt(totpSecret, masterKey),
        accessTokenEncrypted,
        tokenExpiresAt: expiresAt,
        lastRefreshAt: new Date(),
        refreshCountToday: 1,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: growwCredentials.userId,
        set: {
          accessTokenEncrypted,
          tokenExpiresAt: expiresAt,
          lastRefreshAt: new Date(),
          refreshCountToday: sql`${growwCredentials.refreshCountToday} + 1`,
          updatedAt: new Date(),
        },
      });

    await logAuditEvent({
      userId,
      action: 'GROWW_TOKEN_SYNCED',
      entityType: 'groww_credentials',
      entityId: cred?.id ?? userId,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    });

    return { synced: true, tokenExpiresAt: expiresAt, source: cred ? 'db' : 'env' };
  });
