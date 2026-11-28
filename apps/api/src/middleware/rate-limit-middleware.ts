import { Elysia } from 'elysia';

interface BucketEntry {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private buckets = new Map<string, BucketEntry>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  check(key: string, nowMs: number = Date.now()): { allowed: boolean; remaining: number; retryAfterSec: number } {
    const cutoff = nowMs - this.windowMs;
    const entry = this.buckets.get(key) ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldest = entry.timestamps[0] ?? nowMs;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - nowMs) / 1000));
      this.buckets.set(key, entry);
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    entry.timestamps.push(nowMs);
    this.buckets.set(key, entry);
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - entry.timestamps.length),
      retryAfterSec: 0,
    };
  }
}

async function checkUpstashRedisRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSec: number } | null> {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(1_500),
      body: JSON.stringify([
        ['INCR', key],
        ['PEXPIRE', key, String(windowMs), 'NX'],
        ['PTTL', key],
      ]),
    });
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ result?: number }>;
    const count = Number(results[0]?.result ?? 0);
    const pttlMs = Math.max(1000, Number(results[2]?.result ?? windowMs));
    return {
      allowed: count <= maxRequests,
      retryAfterSec: count <= maxRequests ? 0 : Math.max(1, Math.ceil(pttlMs / 1000)),
    };
  } catch {
    return null;
  }
}

export const granularLimiters = new Map<string, SlidingWindowRateLimiter>();

export async function enforceRateLimit(
  name: string,
  request: Request,
  set: { status?: number | string | any; headers?: Record<string, any> | any },
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; error?: string; retryAfterSec?: number }> {
  let limiter = granularLimiters.get(name);
  if (!limiter) {
    limiter = new SlidingWindowRateLimiter(maxRequests, windowMs);
    granularLimiters.set(name, limiter);
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'local';
  const key = `rl:${name}:${ip}`;

  const redisResult = await checkUpstashRedisRateLimit(key, maxRequests, windowMs);
  const result = redisResult ?? limiter.check(key);

  if (!result.allowed) {
    set.status = 429;
    if (set.headers) {
      set.headers['retry-after'] = String(result.retryAfterSec);
    }
    return {
      allowed: false,
      error: 'Too Many Requests',
      retryAfterSec: result.retryAfterSec,
    };
  }

  return { allowed: true };
}

export function createRateLimitPlugin(options: {
  name: string;
  maxRequests: number;
  windowMs: number;
}) {
  const limiter = new SlidingWindowRateLimiter(options.maxRequests, options.windowMs);

  return new Elysia({ name: options.name }).onBeforeHandle(async ({ request, set }) => {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'local';
    const key = `rl:${options.name}:${ip}`;

    const redisResult = await checkUpstashRedisRateLimit(key, options.maxRequests, options.windowMs);
    const result = redisResult ?? limiter.check(key);

    if (!result.allowed) {
      set.status = 429;
      set.headers['retry-after'] = String(result.retryAfterSec);
      return {
        error: 'Too Many Requests',
        retryAfterSec: result.retryAfterSec,
      };
    }
  });
}
