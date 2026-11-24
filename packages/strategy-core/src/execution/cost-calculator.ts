// ============================================
// Cost Calculator with Dated Configuration
// ============================================

import { CostConfig } from '../types';

/**
 * Calculate transaction costs for a trade leg
 */
export interface LegCosts {
  brokerage: number;
  stt: number;
  exchange: number;
  gst: number;
  sebi: number;
  stamp: number;
  slippage: number;
  total: number;
}

/**
 * Calculate costs for a single order (entry or exit)
 */
export function calculateLegCosts(
  config: CostConfig,
  premium: number,
  quantity: number,
  side: 'BUY' | 'SELL',
  bid?: number,
  ask?: number
): LegCosts {
  const turnover = premium * quantity;

  // Brokerage (per order)
  const brokerage = config.brokeragePerOrder;

  // STT: Only on SELL side for options (on premium)
  // Note: STT on options was revised to 0.1% (0.001) in recent years
  const stt = side === 'SELL' ? turnover * config.sttPct : 0;

  // Exchange transaction charge (on premium)
  const exchange = turnover * config.exchangePct;

  // GST: 18% on (brokerage + exchange)
  const gst = (brokerage + exchange) * config.gstPct;

  // SEBI fees: ₹10 per crore of turnover
  const sebi = (turnover / 10_000_000) * config.sebiPerCrore;

  // Stamp duty: Only on BUY side (0.003%)
  const stamp = side === 'BUY' ? turnover * config.stampPct : 0;

  // Slippage: Based on bid-ask spread
  let slippage = 0;
  if (bid !== undefined && ask !== undefined && ask > bid) {
    const spread = ask - bid;
    const slippageAmount = spread * config.slippageSpreadFraction;
    slippage = slippageAmount * quantity;
  } else if (config.defaultSpreadPct) {
    // Modelled spread if bid/ask not available
    const modelledSpread = premium * config.defaultSpreadPct;
    const slippageAmount = modelledSpread * config.slippageSpreadFraction;
    slippage = slippageAmount * quantity;
  }

  const total = brokerage + stt + exchange + gst + sebi + stamp + slippage;

  return {
    brokerage,
    stt,
    exchange,
    gst,
    sebi,
    stamp,
    slippage,
    total
  };
}

/**
 * Calculate net P&L for a trade
 */
export interface TradePnL {
  grossPnl: number;
  entryCosts: LegCosts;
  exitCosts: LegCosts;
  totalCosts: number;
  netPnl: number;
}

export function calculateTradePnL(
  config: CostConfig,
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  side: 'LONG' | 'SHORT',
  entryBid?: number,
  entryAsk?: number,
  exitBid?: number,
  exitAsk?: number
): TradePnL {
  // For LONG: entry = BUY, exit = SELL
  // For SHORT: entry = SELL, exit = BUY
  const entrySide = side === 'LONG' ? 'BUY' : 'SELL';
  const exitSide = side === 'LONG' ? 'SELL' : 'BUY';

  const entryCosts = calculateLegCosts(config, entryPrice, quantity, entrySide, entryBid, entryAsk);
  const exitCosts = calculateLegCosts(config, exitPrice, quantity, exitSide, exitBid, exitAsk);

  // Gross P&L
  let grossPnl: number;
  if (side === 'LONG') {
    grossPnl = (exitPrice - entryPrice) * quantity;
  } else {
    grossPnl = (entryPrice - exitPrice) * quantity;
  }

  const totalCosts = entryCosts.total + exitCosts.total;
  const netPnl = grossPnl - totalCosts;

  return {
    grossPnl,
    entryCosts,
    exitCosts,
    totalCosts,
    netPnl
  };
}

/**
 * Default cost config (2024+ rates - verify with current broker schedule)
 * Source of truth: cost_configs table in DB
 */
export const DEFAULT_COST_CONFIG: CostConfig = {
  effectiveFrom: '2024-01-01',
  brokeragePerOrder: 20,
  sttPct: 0.001,        // 0.1% on sell side (verify current rate)
  exchangePct: 0.0005,  // 0.05%
  gstPct: 0.18,
  sebiPerCrore: 10,
  stampPct: 0.00003,    // 0.003% on buy side
  defaultSpreadPct: 0.01, // 1% of premium for modelled data
  slippageSpreadFraction: 0.5, // 50% of spread
  createdAt: new Date()
};

/**
 * Cost configs by date (for backtesting historical periods)
 */
export const HISTORICAL_COST_CONFIGS: CostConfig[] = [
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
    createdAt: new Date()
  },
  {
    effectiveFrom: '2023-01-01',
    effectiveTo: '2023-12-31',
    brokeragePerOrder: 20,
    sttPct: 0.0005,  // Old rate
    exchangePct: 0.00053,
    gstPct: 0.18,
    sebiPerCrore: 10,
    stampPct: 0.00003,
    defaultSpreadPct: 0.01,
    slippageSpreadFraction: 0.5,
    createdAt: new Date()
  },
];

/**
 * Get cost config for a specific date
 */
export function getCostConfigForDate(date: Date, configs: CostConfig[] = HISTORICAL_COST_CONFIGS): CostConfig {
  const target = date.getTime();

  // Sort by effectiveFrom descending
  const sorted = [...configs].sort((a, b) =>
    new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
  );

  for (const config of sorted) {
    const from = new Date(config.effectiveFrom).getTime();
    const to = config.effectiveTo ? new Date(config.effectiveTo).getTime() : Infinity;

    if (target >= from && target <= to) {
      return config;
    }
  }

  // Fallback to latest
  return sorted[0] || DEFAULT_COST_CONFIG;
}

/**
 * Example cost breakdown for 1 lot NIFTY (for documentation)
 */
export function exampleCostBreakdown(): void {
  const config = DEFAULT_COST_CONFIG;
  const premium = 200;
  const quantity = 75; // Current NIFTY lot size

  console.log('=== Cost Breakdown (1 Lot NIFTY @ ₹200) ===');
  console.log('');

  const entry = calculateLegCosts(config, premium, quantity, 'BUY', 199.5, 200.5);
  const exit = calculateLegCosts(config, premium, quantity, 'SELL', 199.5, 200.5);

  console.log('ENTRY (BUY):');
  console.log(`  Brokerage:    ₹${entry.brokerage.toFixed(2)}`);
  console.log(`  STT:          ₹${entry.stt.toFixed(2)} (buy side = 0)`);
  console.log(`  Exchange:     ₹${entry.exchange.toFixed(2)}`);
  console.log(`  GST:          ₹${entry.gst.toFixed(2)}`);
  console.log(`  SEBI:         ₹${entry.sebi.toFixed(2)}`);
  console.log(`  Stamp Duty:   ₹${entry.stamp.toFixed(2)}`);
  console.log(`  Slippage:     ₹${entry.slippage.toFixed(2)}`);
  console.log(`  Total Entry:  ₹${entry.total.toFixed(2)}`);
  console.log('');

  console.log('EXIT (SELL):');
  console.log(`  Brokerage:    ₹${exit.brokerage.toFixed(2)}`);
  console.log(`  STT:          ₹${exit.stt.toFixed(2)} (0.1% of premium)`);
  console.log(`  Exchange:     ₹${exit.exchange.toFixed(2)}`);
  console.log(`  GST:          ₹${exit.gst.toFixed(2)}`);
  console.log(`  SEBI:         ₹${exit.sebi.toFixed(2)}`);
  console.log(`  Stamp Duty:   ₹${exit.stamp.toFixed(2)} (sell side = 0)`);
  console.log(`  Slippage:     ₹${exit.slippage.toFixed(2)}`);
  console.log(`  Total Exit:   ₹${exit.total.toFixed(2)}`);
  console.log('');

  console.log(`ROUND TRIP: ₹${(entry.total + exit.total).toFixed(2)}`);
  console.log(`As % of premium: ${(((entry.total + exit.total) / (premium * quantity)) * 100).toFixed(2)}%`);
}