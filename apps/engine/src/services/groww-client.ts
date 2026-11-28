// ============================================
// Groww API Client (Engine-side - holds credentials)
// Supports Groww TOTP Flow (TOTP Token + Base32 QR Secret)
// ============================================

import pino from 'pino';
import { config } from '../config';
import { db } from '../index';
import { growwCredentials } from '../../../api/src/db/schema';
import { encrypt, decrypt, getMasterKey } from '../../../api/src/utils/encryption';
import { eq, sql } from 'drizzle-orm';
import { authenticator } from 'otplib';

interface GrowwAuthResponse {
  access_token?: string;
  token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export class GrowwClient {
  private logger: pino.Logger;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private userId: string | null = null;
  private totpToken: string | null = null;
  private totpSecret: string | null = null;
  private refreshInFlight: Promise<void> | null = null;

  constructor(private growwConfig: { apiBaseUrl: string }, logger: pino.Logger) {
    this.logger = logger.child({ component: 'GrowwClient' });
  }

  async initialize(): Promise<void> {
    const creds = await db
      .select()
      .from(growwCredentials)
      .where(eq(growwCredentials.isActive, true))
      .limit(1);

    if (creds.length === 0) {
      // Fallback to .env for local single-user dev
      const envToken = process.env['GROWW_TOTP_TOKEN'];
      const envSecret = process.env['GROWW_TOTP_SECRET'];
      if (envToken && envSecret && !envToken.startsWith('your-')) {
        this.totpToken = envToken;
        this.totpSecret = envSecret;
        await this.login(envToken, envSecret);
        return;
      }
      throw new Error('No active Groww credentials found');
    }

    const cred = creds[0]!;
    this.userId = cred.userId;
    const masterKey = getMasterKey();

    this.totpToken = decrypt(cred.apiKeyEncrypted, masterKey);
    this.totpSecret = decrypt(cred.totpSecretEncrypted, masterKey);

    if (cred.accessTokenEncrypted && cred.tokenExpiresAt && cred.tokenExpiresAt > new Date()) {
      this.accessToken = decrypt(cred.accessTokenEncrypted, masterKey);
      this.refreshToken = cred.refreshTokenEncrypted
        ? decrypt(cred.refreshTokenEncrypted, masterKey)
        : null;
      this.tokenExpiry = cred.tokenExpiresAt;
      this.logger.info('Loaded existing valid Groww tokens');
    } else {
      await this.login(this.totpToken, this.totpSecret);
    }
  }

  private async login(totpToken: string, totpSecret: string): Promise<void> {
    const totp = authenticator.generate(totpSecret);

    const response = await fetch(`${this.growwConfig.apiBaseUrl}/v1/token/api/access`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${totpToken}`,
        'X-API-VERSION': '1.0',
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ key_type: 'totp', totp }),
    });

    if (!response.ok) {
      throw new Error(`Groww login failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GrowwAuthResponse;
    this.accessToken = data.access_token ?? data.token ?? null;
    this.refreshToken = data.refresh_token ?? null;
    const expiresInSec = data.expires_in ?? 12 * 3600;
    this.tokenExpiry = new Date(Date.now() + expiresInSec * 1000);

    await this.storeTokens();
    this.logger.info('Groww TOTP login successful');
  }

  private async refreshAccessToken(): Promise<void> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    if (!this.totpToken || !this.totpSecret) {
      throw new Error('No TOTP credentials available for token refresh');
    }

    this.refreshInFlight = this.login(this.totpToken, this.totpSecret).finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async storeTokens(): Promise<void> {
    if (!this.userId || !this.accessToken) return;

    const masterKey = getMasterKey();

    await db
      .update(growwCredentials)
      .set({
        accessTokenEncrypted: encrypt(this.accessToken, masterKey),
        refreshTokenEncrypted: this.refreshToken ? encrypt(this.refreshToken, masterKey) : null,
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

  private async fetchAuthedJson<T>(path: string): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.growwConfig.apiBaseUrl}${path}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Groww API ${path} failed (${response.status}): ${body.slice(0, 200)}`);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  async getProfile(): Promise<unknown> {
    return this.fetchAuthedJson('/v1/user/profile');
  }

  async getFunds(): Promise<unknown> {
    return this.fetchAuthedJson('/v1/user/funds');
  }

  async getHoldings(): Promise<unknown> {
    return this.fetchAuthedJson('/v1/user/holdings');
  }

  async getPositions(): Promise<{ data?: Array<Record<string, any>> }> {
    return this.fetchAuthedJson<{ data?: Array<Record<string, any>> }>('/v1/user/positions');
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
    idempotencyKey?: string;
  }): Promise<unknown> {
    const token = await this.getAccessToken();
    const idempotencyKey = order.idempotencyKey ?? crypto.randomUUID();
    const algoName = process.env['GROWW_ALGO_NAME'] || process.env['ALGO_NAME'] || 'AI_TRADER_921_EMA';

    const { idempotencyKey: _ignored, ...orderPayload } = order;
    const response = await fetch(`${this.growwConfig.apiBaseUrl}/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Idempotency-Key': idempotencyKey,
        'X-Algo-Name': algoName,
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        ...orderPayload,
        tag: 'ai_trader_algo',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Groww order placement failed (${response.status}): ${body.slice(0, 200)}`);
    }
    return response.json();
  }

  async cancelOrder(orderId: string): Promise<unknown> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.growwConfig.apiBaseUrl}/v1/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Groww order cancellation failed (${response.status}): ${body.slice(0, 200)}`);
    }
    return response.json();
  }

  async getOrderHistory(): Promise<unknown> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.growwConfig.apiBaseUrl}/v1/orders`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  }

  async getOptionChain(underlying: string, expiry: string): Promise<unknown> {
    const token = await this.getAccessToken();
    const response = await fetch(
      `${this.growwConfig.apiBaseUrl}/v1/market/option-chain?symbol=${underlying}&expiry=${expiry}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.json();
  }

  private async safeJson(response: Response, label: string): Promise<any> {
    const text = await response.text();
    if (!response.ok) {
      this.logger.warn({ status: response.status, label, body: text.slice(0, 200) }, 'Groww API non-OK response');
      return { error: `${label} failed (${response.status})`, candles: [] };
    }
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      this.logger.warn({ label, body: text.slice(0, 200) }, 'Groww API returned non-JSON body');
      return { error: `${label} invalid JSON`, candles: [] };
    }
  }

  async getHistoricalCandles(symbol: string, interval: string, from: Date, to: Date): Promise<unknown> {
    const token = await this.getAccessToken();
    const intervalMinutes = interval === '1m' ? 1 : interval === '5m' ? 5 : interval === '15m' ? 15 : 30;
    const qs = new URLSearchParams({
      exchange: 'NSE',
      segment: 'CASH',
      trading_symbol: symbol,
      start_time: from.toISOString(),
      end_time: to.toISOString(),
      interval_in_minutes: String(intervalMinutes),
    });
    const response = await fetch(
      `${this.growwConfig.apiBaseUrl}/v1/historical/candle/range?${qs.toString()}`,
      { headers: { 'Authorization': `Bearer ${token}`, 'X-API-VERSION': '1.0' } }
    );
    return this.safeJson(response, 'getHistoricalCandles');
  }

  /** S8-004: Historical candle range endpoint (/v1/historical/candle/range) */
  async getHistoricalCandleRange(params: {
    exchange: string;
    segment: string;
    tradingSymbol: string;
    startTime: string;
    endTime: string;
    intervalInMinutes: number;
  }): Promise<unknown> {
    const token = await this.getAccessToken();
    const qs = new URLSearchParams({
      exchange: params.exchange,
      segment: params.segment,
      trading_symbol: params.tradingSymbol,
      start_time: params.startTime,
      end_time: params.endTime,
      interval_in_minutes: String(params.intervalInMinutes),
    });
    const response = await fetch(
      `${this.growwConfig.apiBaseUrl}/v1/historical/candle/range?${qs.toString()}`,
      { headers: { 'Authorization': `Bearer ${token}`, 'X-API-VERSION': '1.0' } }
    );
    return response.json();
  }

  /** S8-002: Live Margin & Funds Detail (/v1/margins/detail/user) */
  async getMarginDetails(): Promise<unknown> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.growwConfig.apiBaseUrl}/v1/margins/detail/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-API-VERSION': '1.0' },
    });
    return response.json();
  }

  /** S8-003: Broker-Side Smart Orders (OCO / GTT via /v1/order-advance/create) */
  async createSmartOrder(payload: {
    smartOrderType: 'OCO' | 'GTT';
    tradingSymbol: string;
    exchange: 'NSE' | 'BSE';
    segment: 'CASH' | 'FNO';
    quantity: number;
    productType: 'CNC' | 'MIS' | 'NRML';
    transactionType: 'BUY' | 'SELL';
    targetPrice?: number;
    stopLossPrice?: number;
    triggerPrice?: number;
    validity?: string;
  }): Promise<unknown> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.growwConfig.apiBaseUrl}/v1/order-advance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-API-VERSION': '1.0',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        smart_order_type: payload.smartOrderType,
        trading_symbol: payload.tradingSymbol,
        exchange: payload.exchange,
        segment: payload.segment,
        quantity: payload.quantity,
        product_type: payload.productType,
        transaction_type: payload.transactionType,
        target_price: payload.targetPrice,
        stop_loss_price: payload.stopLossPrice,
        trigger_price: payload.triggerPrice,
        validity: payload.validity ?? 'GTC',
      }),
    });
    return response.json();
  }

  async close(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.totpToken = null;
    this.totpSecret = null;
  }
}
