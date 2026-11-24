// ============================================
// Database Seed Script (Phase 1 Foundation)
// ============================================

import { db } from './index';
import { userProfiles, instruments, costConfigs } from './schema';
import { eq } from 'drizzle-orm';

// Sample instrument data for NIFTY and BANKNIFTY
// These will be fetched from NSE/SEBI and updated periodically
const sampleInstruments = [
  // NIFTY Index
  {
    symbol: 'NIFTY',
    instrumentType: 'INDEX',
    name: 'NIFTY 50',
    exchange: 'NSE',
    segment: 'FO',
    lotSize: 75,
    tickSize: 0.05,
    strikeStep: 50,
    underlyingSymbol: 'NIFTY',
    isActive: true,
    validFrom: new Date('2024-01-01'),
    validTo: null,
    growwToken: 'NIFTY-IDX',
  },
  // BANKNIFTY Index
  {
    symbol: 'BANKNIFTY',
    instrumentType: 'INDEX',
    name: 'Nifty Bank',
    exchange: 'NSE',
    segment: 'FO',
    lotSize: 25,
    tickSize: 0.05,
    strikeStep: 100,
    underlyingSymbol: 'BANKNIFTY',
    isActive: true,
    validFrom: new Date('2024-01-01'),
    validTo: null,
    growwToken: 'BANKNIFTY-IDX',
  },
  // NIFTY CE 24JAN18000
  {
    symbol: 'NIFTY',
    instrumentType: 'OPT',
    name: 'NIFTY 18Jan24 18000 CE',
    exchange: 'NSE',
    segment: 'FO',
    lotSize: 25,
    tickSize: 0.05,
    strikeStep: 50,
    underlyingSymbol: 'NIFTY',
    strikePrice: 18000,
    optionType: 'CE',
    expiryDate: new Date('2024-01-18'),
    expiryType: 'WEEKLY',
    isActive: true,
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2024-01-20'),
    growwToken: 'NIFTY24JAN18000CE',
  },
  // NIFTY PE 24JAN18000
  {
    symbol: 'NIFTY',
    instrumentType: 'OPT',
    name: 'NIFTY 18Jan24 18000 PE',
    exchange: 'NSE',
    segment: 'FO',
    lotSize: 25,
    tickSize: 0.05,
    strikeStep: 50,
    underlyingSymbol: 'NIFTY',
    strikePrice: 18000,
    optionType: 'PE',
    expiryDate: new Date('2024-01-18'),
    expiryType: 'WEEKLY',
    isActive: true,
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2024-01-20'),
    growwToken: 'NIFTY24JAN18000PE',
  },
  // Cost configs (2024+ rates)
  {
    effectiveFrom: '2024-01-01',
    brokeragePerOrder: 20,
    sttPct: 0.001,
    exchangePct: 0.0005,
    gstPct: 0.18,
    sebiPerCrore: 10,
    stampPct: 0.00003,
    defaultSpreadPct: 0.01,
    slippageSpreadFraction: 0.5,
  },
];

export async function seed(): Promise<void> {
  console.log('Seeding database...');

  // Insert instruments (with conflict handling)
  for (const inst of sampleInstruments) {
    // Check if already exists
    const existing = await db
      .select()
      .from(instruments)
      .where(eq(instruments.growwToken, inst.growwToken));

    if (existing.length === 0) {
      await db.insert(instruments).values(inst);
      console.log(`  Inserted instrument: ${inst.symbol}`);
    }
  }

  // Check if cost configs already exist
  const existingCosts = await db
    .select()
    .from(costConfigs)
    .where(eq(costConfigs.effectiveFrom, '2024-01-01'));

  if (existingCosts.length === 0) {
    await db.insert(costConfigs).values(sampleInstruments[sampleInstruments.length - 1]);
    console.log('  Inserted cost config');
  }

  // Create owner user profile via Better Auth
  // This would typically be done after first login
  // The owner role will be assigned manually

  console.log('Seed complete.');
}