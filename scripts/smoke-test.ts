#!/usr/bin/env bun
// ============================================
// Production / Local Smoke Test (S6-012)
// Usage: API_URL=http://localhost:3000 ENGINE_URL=http://localhost:3001 bun run scripts/smoke-test.ts
// ============================================

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000';
const ENGINE_URL = process.env['ENGINE_URL'] ?? 'http://localhost:3001';

async function assertStep(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}:`, err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

await assertStep('API /health returns ok + db connected', async () => {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { status?: string; db?: string };
  if (data.status !== 'ok') throw new Error(`Unexpected status: ${JSON.stringify(data)}`);
});

await assertStep('Engine /health responds', async () => {
  const res = await fetch(`${ENGINE_URL}/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

await assertStep('Unauthenticated /api/live/gates returns 401', async () => {
  const res = await fetch(`${API_URL}/api/live/gates`);
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

let demoCookie = '';

await assertStep('Demo login succeeds and returns session cookie', async () => {
  const res = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({
      email: process.env['DEMO_EMAIL'] ?? 'demo@aitrader.in',
      password: process.env['DEMO_PASSWORD'] ?? 'Demo@2025',
    }),
  });
  if (!res.ok) throw new Error(`Login failed: HTTP ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('Missing set-cookie header');
  demoCookie = setCookie.split(';')[0] ?? '';
});

await assertStep('GET /api/auth/session returns DEMO role', async () => {
  const res = await fetch(`${API_URL}/api/auth/session`, {
    headers: { Cookie: demoCookie },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { user?: { role?: string } };
  if (data.user?.role !== 'DEMO') throw new Error(`Expected DEMO role, got ${data.user?.role}`);
});

await assertStep('POST /api/live/enable is blocked (403) for DEMO user', async () => {
  const res = await fetch(`${API_URL}/api/live/enable`, {
    method: 'POST',
    headers: { Cookie: demoCookie },
  });
  if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
});

await assertStep('GET /api/upstox/status & /api/watchlist return 200', async () => {
  const [u, w] = await Promise.all([
    fetch(`${API_URL}/api/upstox/status`, { headers: { Cookie: demoCookie } }),
    fetch(`${API_URL}/api/watchlist`, { headers: { Cookie: demoCookie } }),
  ]);
  if (!u.ok) throw new Error(`/api/upstox/status failed: ${u.status}`);
  if (!w.ok) throw new Error(`/api/watchlist failed: ${w.status}`);
});

await assertStep('GET /api/auth/sessions, /api/audit, /api/engine/health, /api/user/profile return 200', async () => {
  const [sess, aud, eng, prof] = await Promise.all([
    fetch(`${API_URL}/api/auth/sessions`, { headers: { Cookie: demoCookie } }),
    fetch(`${API_URL}/api/audit`, { headers: { Cookie: demoCookie } }),
    fetch(`${API_URL}/api/engine/health`, { headers: { Cookie: demoCookie } }),
    fetch(`${API_URL}/api/user/profile`, { headers: { Cookie: demoCookie } }),
  ]);
  if (!sess.ok) throw new Error(`/api/auth/sessions failed: ${sess.status}`);
  if (!aud.ok) throw new Error(`/api/audit failed: ${aud.status}`);
  if (!eng.ok) throw new Error(`/api/engine/health failed: ${eng.status}`);
  if (!prof.ok) throw new Error(`/api/user/profile failed: ${prof.status}`);
  const sessJson = (await sess.json()) as { maxSessions?: number };
  if (sessJson.maxSessions !== 3) throw new Error(`Expected maxSessions=3, got ${sessJson.maxSessions}`);
});
