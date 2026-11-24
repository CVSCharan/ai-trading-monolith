// ============================================
// Groww API Client (Engine-side - holds credentials)
// ============================================

import pino from 'pino';
import { config } from '../config';
import { db } from '../index';
import { growwCredentials } from '../../api/src/db/schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import CryptoJS from 'crypto-js';
import { authenticator } from 'otplib';

interface GrowwTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export class GrowwClient {
  private logger: pino.Logger;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private userId: string | null = null;

  constructor(private growwConfig: any, logger: pino.Logger) {
    this.logger = logger.child({ component: 'GrowwClient' });
  }

  async initialize(): Promise<void> {
    // Load credentials for first active user
    // In production, this would be per-user
    const creds = await db
      .select()
      .from(growwCredentials)
      .where(eq(growwCredentials.isActive, true))
      .limit(1);

    if (creds.length === 0) {
      throw new Error('No active Groww credentials found');
    }

    const cred = creds[0];
    this.userId = cred.userId;

    // Decrypt credentials
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('ENCRYPTION_MASTER_KEY not set');
    }

    const apiKey = this.decrypt(cred.apiKeyEncrypted, masterKey);
    const apiSecret = this.decrypt(cred.apiSecretEncrypted, masterKey);
    const totpSecret = this.decrypt(cred.totpSecretEncrypted, masterKey);

    // Load existing tokens if valid
    if (cred.accessTokenEncrypted && cred.tokenExpiresAt && cred.tokenExpiresAt > new Date()) {
      this.accessToken = this.decrypt(cred.accessTokenEncrypted, masterKey);
      this.refreshToken = this.decrypt(cred.refreshTokenEncrypted!, masterKey);
      this.tokenExpiry = cred.tokenExpiresAt;
      this.logger.info('Loaded existing valid tokens');
    } else {
      // Fresh login with TOTP
      await this.login(apiKey, apiSecret, totpSecret);
    }
  }

  private async login(apiKey: string, apiSecret: string, totpSecret: string): Promise<void> {
    const totp = authenticator.generate(totpSecret);

    // Groww login flow (adjust to actual API)
    // This is a simplified version - real implementation needs Groww's specific endpoints
    const response = await fetch(`${config.groww.apiBaseUrl}/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret,
      },
      body: JSON.stringify({ totp }),
    });

    if (!response.ok) {
      throw new Error(`Groww login failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

    // Store encrypted tokens
    await this.storeTokens();

    this.logger.info('Groww login successful');
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${config.groww.apiBaseUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.refreshToken}`,
      },
    });

    if (!response.ok) {
      // Re-login required
      throw new Error('Token refresh failed, re-login needed');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

    await this.storeTokens();
    this.logger.info('Access token refreshed');
  }

  private async storeTokens(): Promise<void> {
    if (!this.userId) return;

    const masterKey = process.env.ENCRYPTION_MASTER_KEY!;

    await db
      .update(growwCredentials)
      .set({
        accessTokenEncrypted: this.encrypt(this.accessToken!, masterKey),
        refreshTokenEncrypted: this.encrypt(this.refreshToken!, masterKey),
        tokenExpiresAt: this.tokenExpiry,
        lastRefreshAt: new Date(),
        refreshCountToday: sql`${growwCredentials.refreshCountToday} + 1`,
      })
      .where(eq(growwCredentials.userId, this.userId));
  }

  async getAccessToken(): Promise<string> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry <= new Date(Date.now() + 60000)) {
      await this.refreshAccessToken();
    }
    return this.accessToken!;
  }

  async getProfile(): Promise<any> {
    const token = await this.getAccessToken();
    const response = await fetch(`${config.groww.apiBaseUrl}/v1/user/profile`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  }

  async getFunds(): Promise<any> {
    const token = await this.getAccessToken();
    const response = await fetch(`${config.groww.apiBaseUrl}/v1/user/funds`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  }

  async getHoldings(): Promise<any> {
    const token = await this.getAccessToken();
    const response = await fetch(`${config.groww.apiBaseUrl}/v1/user/holdings`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  }

  async getPositions(): Promise<any> {
    const token = await this.getAccessToken();
    const response = await fetch(`${config.groww.apiBaseUrl}/v1/user/positions`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  }

  async placeOrder(order: {
    symbol: string;
    exchange: string;
    quantity: number;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    price?: number;
    triggerPrice?: number;
    product: 'CNC' | 'MIS' | 'NRML';
    validity: 'DAY' | 'IOC';
  }): Promise<any> {
    const token = await this.getAccessToken();
    const idempotencyKey = crypto.randomUUID();

    const response = await fetch(`${config.groww.apiBaseUrl}/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(order),
    });

    return response.json();
  }

  async cancelOrder(orderId: string): Promise<any> {
    const token = await this.getAccessToken();
    const response = await fetch(`${config.groww.apiBaseUrl}/v1/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  }

  async getOrderHistory(): Promise<any> {
    const token = await this.getAccessToken();
    const response = await fetch(`${config.groww.apiBaseUrl}/v1/orders`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  }

  async getOptionChain(underlying: string, expiry: string): Promise<any> {
    const token = await this.getAccessToken();
    const response = await fetch(`${config.groww.apiBaseUrl}/v1/market/option-chain?symbol=${underlying}&expiry=${expiry}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  }

  async getHistoricalCandles(symbol: string, interval: string, from: Date, to: Date): Promise<any> {
    const token = await this.getAccessToken();
    const response = await fetch(`${config.groww.apiBaseUrl}/v1/market/candles?symbol=${symbol}&interval=${interval}&from=${from.toISOString()}&to=${to.toISOString()}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  }

  private encrypt(text: string, key: string): string {
    return CryptoJS.AES.encrypt(text, key).toString();
  }

  private decrypt(ciphertext: string, key: string): string {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  async close(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }
}