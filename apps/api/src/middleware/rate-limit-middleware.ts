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

export function createRateLimitPlugin(options: {
  name: string;
  maxRequests: number;
  windowMs: number;
}) {
  const limiter = new SlidingWindowRateLimiter(options.maxRequests, options.windowMs);

  return new Elysia({ name: options.name }).onBeforeHandle(({ request, set }) => {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'local';
    const key = `${options.name}:${ip}`;
    const result = limiter.check(key);

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
