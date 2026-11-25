#!/usr/bin/env bun
/**
 * Emergency Stop CLI (S6-006)
 * Usage: bun run emergency-stop --user=<userId> --reason="market crash"
 * Writes EMERGENCY_STOP command directly to Postgres (bypasses WebSocket).
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

function parseArg(prefix: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

const userId = parseArg('--user=');
const reason = parseArg('--reason=') ?? 'CLI emergency stop';

if (!userId) {
  console.error('Usage: bun run emergency-stop --user=<userId> --reason="..."');
  process.exit(1);
}

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

try {
  await db.execute(
    sql`UPDATE user_profiles SET live_trading_enabled = false, updated_at = NOW() WHERE user_id = ${userId}`
  );
  await db.execute(
    sql`INSERT INTO engine_commands (user_id, command_type, payload, status, created_at)
        VALUES (${userId}, 'EMERGENCY_STOP', ${JSON.stringify({ reason })}::jsonb, 'PENDING', NOW())`
  );
  console.log(`EMERGENCY_STOP queued for user ${userId} (reason: ${reason})`);
} finally {
  await client.end();
}
