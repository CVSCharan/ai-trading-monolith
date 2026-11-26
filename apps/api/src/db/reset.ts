// ============================================
// Database Reset & Re-Seed Script
// Safely resets runtime database tables and re-seeds cleanly.
// Strictly guarded against accidental production execution.
// ============================================

import { db, pgClient } from './index';
import { seed } from './seed';
import { logger } from '../logger';
import { sql } from 'drizzle-orm';

export async function resetDatabase(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && process.env['ALLOW_PROD_RESET'] !== 'true') {
    throw new Error('Database reset is strictly blocked in PRODUCTION mode (ALLOW_PROD_RESET !== "true")');
  }

  logger.warn('Initiating database reset & table truncation...');

  try {
    await db.execute(sql`
      TRUNCATE TABLE 
        audit_logs,
        live_fills,
        live_positions,
        paper_trades,
        paper_positions,
        paper_portfolios,
        engine_commands,
        engine_state,
        engine_health,
        reconciliation_state,
        watchlists,
        signals,
        backtest_trades,
        backtest_runs,
        strategies,
        cost_configs,
        instruments,
        user_profiles,
        session,
        account,
        "user"
      CASCADE;
    `);
    logger.info('Tables truncated successfully');
  } catch (err) {
    logger.error({ err }, 'Error during table truncation; proceeding with seed attempt');
  }

  logger.info('Re-seeding database...');
  await seed();
  logger.info('Database reset & re-seed complete ✅');
}

if (import.meta.main || process.argv[1]?.includes('reset.ts')) {
  resetDatabase()
    .then(async () => {
      logger.info('Reset finished successfully ✅');
      await pgClient.end();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error({ err }, 'Database reset failed');
      await pgClient.end();
      process.exit(1);
    });
}
