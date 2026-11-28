import { describe, expect, mock, test } from 'bun:test';
import pino from 'pino';

process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgres://test:test@localhost:5432/test';
process.env['ENCRYPTION_MASTER_KEY'] =
  process.env['ENCRYPTION_MASTER_KEY'] ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-at-least-32-chars-long';

mock.module('../src/index', () => ({
  db: null,
}));

describe('GrowwClient Hardening (GAP-27)', () => {
  test('deduplicates concurrent refreshAccessToken calls into a single TOTP login', async () => {
    const { GrowwClient } = await import('../src/services/groww-client');
    let loginCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      loginCalls++;
      await new Promise((r) => setTimeout(r, 20));
      return new Response(
        JSON.stringify({ access_token: 'tok-123', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    try {
      const client = new GrowwClient({ apiBaseUrl: 'https://api.groww.in' }, pino({ level: 'silent' }));
      (client as any).totpToken = 'totp-tok';
      (client as any).totpSecret = 'JBSWY3DPEHPK3PXP';

      const [t1, t2, t3] = await Promise.all([
        client.getAccessToken(),
        client.getAccessToken(),
        client.getAccessToken(),
      ]);

      expect(t1).toBe('tok-123');
      expect(t2).toBe('tok-123');
      expect(t3).toBe('tok-123');
      expect(loginCalls).toBe(1);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
