// ============================================
// Database Seed Script (Phase 1 Foundation)
// ============================================

import { db } from './index';
import { instruments, costConfigs } from './schema';
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

export async function seed(): Promise<void> {
  logger.info('Seeding database...');

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

  logger.info('Seed complete.');
}
