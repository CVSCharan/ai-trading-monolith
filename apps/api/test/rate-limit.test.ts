import { describe, expect, test } from 'bun:test';
import { SlidingWindowRateLimiter } from '../src/middleware/rate-limit-middleware';

describe('SlidingWindowRateLimiter (S3-002)', () => {
  test('allows requests up to limit and blocks excess with retryAfterSec', () => {
    const limiter = new SlidingWindowRateLimiter(3, 60_000);
    const t0 = 1_000_000;

    expect(limiter.check('ip:1', t0).allowed).toBe(true);
    expect(limiter.check('ip:1', t0 + 100).allowed).toBe(true);
    expect(limiter.check('ip:1', t0 + 200).allowed).toBe(true);

    const blocked = limiter.check('ip:1', t0 + 300);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(59);

    // After window slides past t0, requests are allowed again
    const afterWindow = limiter.check('ip:1', t0 + 60_001);
    expect(afterWindow.allowed).toBe(true);
  });
});
