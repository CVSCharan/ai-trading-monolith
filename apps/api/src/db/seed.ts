// ============================================
// Database Seed Script
// - Phase 1: Instruments + Cost Configs
// - Phase 2: SUPER_ADMIN + DEMO accounts + demo paper trades
// ============================================

import { db } from './index';
import { instruments, costConfigs, userProfiles, paperPortfolios, paperTrades } from './schema';
import { user, account } from './better-auth-schema';
import { eq, sql } from 'drizzle-orm';
import { hashPassword as betterAuthHashPassword } from 'better-auth/crypto';
import { logger } from '../logger';

const sampleInstruments = [
  {
    symbol: 'NIFTY',
    instrumentType: 'INDEX' as const,
    name: 'NIFTY 50',
    exchange: 'NSE',
    segment: 'FO',
    lotSize: 75,
    tickSize: '0.05',
    strikeStep: 50,
    underlyingSymbol: 'NIFTY',
    isActive: true,
    validFrom: '2024-01-01',
    validTo: null,
    growwToken: 'NIFTY-IDX',
  },
  {
    symbol: 'BANKNIFTY',
    instrumentType: 'INDEX' as const,
    name: 'Nifty Bank',
    exchange: 'NSE',
    segment: 'FO',
    lotSize: 25,
    tickSize: '0.05',
    strikeStep: 100,
    underlyingSymbol: 'BANKNIFTY',
    isActive: true,
    validFrom: '2024-01-01',
    validTo: null,
    growwToken: 'BANKNIFTY-IDX',
  },
  {
    symbol: 'NIFTY',
    instrumentType: 'OPT' as const,
    name: 'NIFTY 18Jan24 18000 CE',
    exchange: 'NSE',
    segment: 'FO',
    lotSize: 25,
    tickSize: '0.05',
    strikeStep: 50,
    underlyingSymbol: 'NIFTY',
    strikePrice: '18000',
    optionType: 'CE' as const,
    expiryDate: '2024-01-18',
    expiryType: 'WEEKLY' as const,
    isActive: true,
    validFrom: '2024-01-01',
    validTo: '2024-01-20',
    growwToken: 'NIFTY24JAN18000CE',
  },
  {
    symbol: 'NIFTY',
    instrumentType: 'OPT' as const,
    name: 'NIFTY 18Jan24 18000 PE',
    exchange: 'NSE',
    segment: 'FO',
    lotSize: 25,
    tickSize: '0.05',
    strikeStep: 50,
    underlyingSymbol: 'NIFTY',
    strikePrice: '18000',
    optionType: 'PE' as const,
    expiryDate: '2024-01-18',
    expiryType: 'WEEKLY' as const,
    isActive: true,
    validFrom: '2024-01-01',
    validTo: '2024-01-20',
    growwToken: 'NIFTY24JAN18000PE',
  },
];

const sampleCostConfig = {
  effectiveFrom: '2024-01-01',
  brokeragePerOrder: '20',
  sttPct: '0.001',
  exchangePct: '0.0005',
  gstPct: '0.18',
  sebiPerCrore: '10',
  stampPct: '0.00003',
  defaultSpreadPct: '0.01',
  slippageSpreadFraction: '0.5',
};

// ── Demo paper trades (realistic but fake, 100+ for pre-live verification S6-011) ──────────
function buildDemoTrades(portfolioId: string) {
  const base = new Date('2026-07-01T09:30:00+05:30');
  const trades = [];

  // Deterministic Lehmer PRNG for stable, reproducible seed metrics
  let seed = 42;
  const pseudoRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const underlyingChoices = [
    { symbol: 'NIFTY', lotSize: 75, baseStrike: 24000, step: 50 },
    { symbol: 'BANKNIFTY', lotSize: 25, baseStrike: 51000, step: 100 },
  ];

  let currentTime = base.getTime();
  let tradeIndex = 0;

  while (trades.length < 110) {
    currentTime += 24 * 60 * 60 * 1000;
    const d = new Date(currentTime);
    const dayOfWeek = d.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    const u = underlyingChoices[tradeIndex % 2];
    const isWin = pseudoRand() < 0.62; // ~62% win rate
    const isCE = pseudoRand() < 0.55;
    const optionType = isCE ? 'CE' : 'PE';
    const strikeOffset = Math.floor(pseudoRand() * 3) * u.step;
    const strike = isCE ? u.baseStrike - strikeOffset : u.baseStrike + strikeOffset;
    const symbol = `${u.symbol}24NOV${strike}${optionType}`;

    const entryPrice = Math.round((80 + pseudoRand() * 220) * 10) / 10;
    const priceChangePct = isWin
      ? 0.15 + pseudoRand() * 0.45 // +15% to +60%
      : -(0.10 + pseudoRand() * 0.20); // -10% to -30%

    const exitPrice = Math.max(1, Math.round(entryPrice * (1 + priceChangePct) * 10) / 10);
    const qty = u.lotSize * (pseudoRand() < 0.7 ? 1 : 2);
    const costs = Math.round(55 + pseudoRand() * 15);
    const grossPnl = Math.round((exitPrice - entryPrice) * qty);
    const netPnl = grossPnl - costs;

    const entryHour = 9 + Math.floor(pseudoRand() * 4);
    const entryMin = Math.floor(pseudoRand() * 12) * 5;
    const entryTime = new Date(d);
    entryTime.setHours(entryHour, entryMin, 0, 0);

    const holdMinutes = 15 + Math.floor(pseudoRand() * 120);
    const exitTime = new Date(entryTime.getTime() + holdMinutes * 60 * 1000);

    const exitReason = !isWin && pseudoRand() < 0.35
      ? ('REVERSAL' as const)
      : exitTime.getHours() >= 15
      ? ('SQUARE_OFF_1500' as const)
      : ('OPPOSITE_CROSSOVER' as const);

    trades.push({
      portfolioId,
      optionSymbol: symbol,
      side: 'BUY' as const,
      entryTime,
      entryPrice: String(entryPrice),
      exitTime,
      exitPrice: String(exitPrice),
      quantity: qty,
      grossPnl: String(grossPnl),
      costs: String(costs),
      netPnl: String(netPnl),
      exitReason,
      fillMetadata: {
        strategyTemplate: 'EMA_9_21',
        underlyingSymbol: u.symbol,
      },
    });

    tradeIndex++;
  }

  return trades;
}

// ============================================
// Hash password using Better Auth scrypt format (salt:key)
// ============================================
async function hashPassword(plain: string): Promise<string> {
  return betterAuthHashPassword(plain);
}

// ============================================
// Upsert user + profile
// ============================================
async function upsertUser(opts: {
  email: string;
  name: string;
  password: string;
  role: 'SUPER_ADMIN' | 'DEMO';
}): Promise<string> {
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, opts.email)).limit(1);
  let userId: string;

  if (existing.length > 0) {
    userId = existing[0].id;
    // Upgrade legacy non-Better-Auth (bcrypt) hashes to Better Auth scrypt salt:key format
    const [existingAcc] = await db
      .select({ id: account.id, password: account.password })
      .from(account)
      .where(eq(account.userId, userId))
      .limit(1);
    if (existingAcc && (!existingAcc.password || !existingAcc.password.includes(':'))) {
      const hashedPw = await hashPassword(opts.password);
      await db
        .update(account)
        .set({ password: hashedPw, updatedAt: new Date() })
        .where(eq(account.id, existingAcc.id));
      logger.info({ email: opts.email }, 'Upgraded password hash to Better Auth format');
    } else {
      logger.info({ email: opts.email }, 'User already exists, skipping insert');
    }
  } else {
    userId = crypto.randomUUID();
    const hashedPw = await hashPassword(opts.password);

    await db.insert(user).values({
      id: userId,
      name: opts.name,
      email: opts.email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert credential record (Better Auth email/password)
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: hashedPw,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info({ email: opts.email, role: opts.role }, 'Created user');
  }

  // Upsert profile with role
  await db
    .insert(userProfiles)
    .values({
      userId,
      displayName: opts.name,
      role: opts.role,
      timezone: 'Asia/Kolkata',
      paperCapital: opts.role === 'DEMO' ? '500000' : '1000000',
      liveTradingEnabled: false,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        role: opts.role,
        displayName: opts.name,
        updatedAt: new Date(),
      },
    });

  return userId;
}

export async function seed(): Promise<void> {
  logger.info('Seeding database...');

  // ── Phase 1: Instruments ─────────────────────────────────────
  try {
    for (const inst of sampleInstruments) {
      await db
        .insert(instruments)
        .values(inst)
        .onConflictDoUpdate({
          target: instruments.growwToken,
          set: {
            name: inst.name,
            lotSize: inst.lotSize,
            tickSize: inst.tickSize,
            strikeStep: inst.strikeStep,
            isActive: inst.isActive,
            validFrom: inst.validFrom,
            validTo: inst.validTo,
          },
        });
    }
    logger.info({ count: sampleInstruments.length }, 'Upserted instruments');
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode !== '42P10') throw err;
    logger.warn('Unique index missing (run `bun run db:push`); skipping instrument upsert');
  }

  // ── Phase 1: Cost Config ─────────────────────────────────────
  await db
    .insert(costConfigs)
    .values(sampleCostConfig)
    .onConflictDoUpdate({
      target: costConfigs.effectiveFrom,
      set: {
        brokeragePerOrder: sampleCostConfig.brokeragePerOrder,
        sttPct: sampleCostConfig.sttPct,
        exchangePct: sampleCostConfig.exchangePct,
        gstPct: sampleCostConfig.gstPct,
        sebiPerCrore: sampleCostConfig.sebiPerCrore,
        stampPct: sampleCostConfig.stampPct,
        defaultSpreadPct: sampleCostConfig.defaultSpreadPct,
        slippageSpreadFraction: sampleCostConfig.slippageSpreadFraction,
      },
    });
  logger.info('Upserted cost config');

  // ── Phase 2: SUPER_ADMIN user ─────────────────────────────────
  const adminEmail = process.env['ADMIN_EMAIL'] ?? 'admin@aitrader.in';
  const adminPassword = process.env['ADMIN_PASSWORD'] ?? 'Admin@2025!';
  await upsertUser({ email: adminEmail, name: 'Admin', password: adminPassword, role: 'SUPER_ADMIN' });
  logger.info({ email: adminEmail }, 'SUPER_ADMIN user ready');

  // ── Phase 2: DEMO user + pre-seeded paper trades ──────────────
  const demoUserId = await upsertUser({
    email: 'demo@aitrader.in',
    name: 'Demo User',
    password: 'Demo@2025',
    role: 'DEMO',
  });
  logger.info('DEMO user ready');

  // Seed demo portfolio + trades
  const existingPortfolios = await db
    .select({ id: paperPortfolios.id })
    .from(paperPortfolios)
    .where(eq(paperPortfolios.userId, demoUserId))
    .limit(1);

  let portfolioId: string;
  if (existingPortfolios.length > 0) {
    portfolioId = existingPortfolios[0].id;
    logger.info('Demo portfolio already exists');
  } else {
    // Generate 110 demo paper trades and compute portfolio total metrics
    const demoTrades = buildDemoTrades('00000000-0000-0000-0000-000000000000');
    const totalNetPnl = demoTrades.reduce((acc, t) => acc + Number(t.netPnl), 0);

    const [portfolio] = await db
      .insert(paperPortfolios)
      .values({
        userId: demoUserId,
        cashBalance: String(500000 + totalNetPnl),
        totalValue: String(500000 + totalNetPnl),
        dayStartValue: '500000',
        dailyPnl: '4200',
        isActive: false,
      })
      .returning({ id: paperPortfolios.id });
    portfolioId = portfolio.id;

    for (const trade of demoTrades) {
      await db.insert(paperTrades).values({ ...trade, portfolioId });
    }
    logger.info({ count: demoTrades.length }, 'Seeded demo paper trades (100+ verified trades)');
  }

  logger.info('Seed complete ✅');
}

// Enable standalone CLI execution (e.g. `bun run src/db/seed.ts` or `bun run db:seed`)
if (import.meta.main || process.argv[1]?.includes('seed.ts')) {
  seed()
    .then(() => {
      logger.info('Database seed finished successfully ✅');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Database seed execution failed');
      process.exit(1);
    });
}
