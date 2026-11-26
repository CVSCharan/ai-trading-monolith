// ============================================
// Database Seed Script
// - Phase 1: Instruments + Cost Configs
// - Phase 2: SUPER_ADMIN + DEMO accounts + demo paper trades
// ============================================

import { db } from './index';
import { instruments, costConfigs, userProfiles, paperPortfolios, paperTrades } from './schema';
import { user, account } from './better-auth-schema';
import { eq, sql } from 'drizzle-orm';
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

// ── Demo paper trades (realistic but fake) ───────────────────────────────
function buildDemoTrades(portfolioId: string) {
  const base = new Date('2026-11-01T09:30:00+05:30');
  const trades = [];
  const scenarios = [
    { symbol: 'NIFTY24NOV18000CE', pnl: 4200, qty: 75, entry: 180, exit: 236, side: 'BUY' as const },
    { symbol: 'BANKNIFTY24NOV45000CE', pnl: -1800, qty: 25, entry: 350, exit: 278, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV18500CE', pnl: 6750, qty: 75, entry: 95, exit: 185, side: 'BUY' as const },
    { symbol: 'BANKNIFTY24NOV44000CE', pnl: 3200, qty: 25, entry: 420, exit: 548, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV18200CE', pnl: -2250, qty: 75, entry: 160, exit: 130, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV18100CE', pnl: 8100, qty: 75, entry: 72, exit: 180, side: 'BUY' as const },
    { symbol: 'BANKNIFTY24NOV44500CE', pnl: 5600, qty: 50, entry: 280, exit: 392, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV18300CE', pnl: -900, qty: 75, entry: 115, exit: 103, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV18050CE', pnl: 3600, qty: 75, entry: 135, exit: 183, side: 'BUY' as const },
    { symbol: 'BANKNIFTY24NOV43500CE', pnl: 7200, qty: 25, entry: 320, exit: 608, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV17950CE', pnl: 2700, qty: 75, entry: 88, exit: 124, side: 'BUY' as const },
    { symbol: 'BANKNIFTY24NOV44200CE', pnl: -3000, qty: 25, entry: 480, exit: 360, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV18150CE', pnl: 5400, qty: 75, entry: 65, exit: 137, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV17900CE', pnl: 1800, qty: 75, entry: 110, exit: 134, side: 'BUY' as const },
    { symbol: 'BANKNIFTY24NOV43000CE', pnl: 4800, qty: 25, entry: 290, exit: 482, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV18400CE', pnl: -1500, qty: 75, entry: 145, exit: 125, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV18250CE', pnl: 9000, qty: 75, entry: 80, exit: 200, side: 'BUY' as const },
    { symbol: 'BANKNIFTY24NOV44800CE', pnl: 2400, qty: 25, entry: 310, exit: 406, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV18350CE', pnl: 3300, qty: 75, entry: 95, exit: 139, side: 'BUY' as const },
    { symbol: 'NIFTY24NOV17800CE', pnl: 6300, qty: 75, entry: 120, exit: 204, side: 'BUY' as const },
  ];

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const dayOffset = i * 24 * 60 * 60 * 1000;
    const entryTime = new Date(base.getTime() + dayOffset);
    const exitTime = new Date(entryTime.getTime() + 2 * 60 * 60 * 1000);
    const costs = 60;
    trades.push({
      portfolioId,
      optionSymbol: s.symbol,
      side: s.side,
      entryTime,
      entryPrice: String(s.entry),
      exitTime,
      exitPrice: String(s.exit),
      quantity: s.qty,
      grossPnl: String(s.pnl + costs),
      costs: String(costs),
      netPnl: String(s.pnl),
      exitReason: 'OPPOSITE_CROSSOVER' as const,
      fillMetadata: {},
    });
  }
  return trades;
}

// ============================================
// Hash password using Better Auth's bcrypt
// ============================================
async function hashPassword(plain: string): Promise<string> {
  // Use Bun's built-in bcrypt
  return Bun.password.hash(plain, { algorithm: 'bcrypt', cost: 12 });
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
    logger.info({ email: opts.email }, 'User already exists, skipping insert');
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
    const [portfolio] = await db
      .insert(paperPortfolios)
      .values({
        userId: demoUserId,
        cashBalance: String(500000 + 48300),
        totalValue: String(500000 + 48300),
        dayStartValue: '500000',
        dailyPnl: '48300',
        isActive: false,
      })
      .returning({ id: paperPortfolios.id });
    portfolioId = portfolio.id;

    const demoTrades = buildDemoTrades(portfolioId);
    for (const trade of demoTrades) {
      await db.insert(paperTrades).values(trade);
    }
    logger.info({ count: demoTrades.length }, 'Seeded demo paper trades');
  }

  logger.info('Seed complete ✅');
}
