// ============================================
// Instrument Resolution: Strike/Expiry Selection
// ============================================

import { Instrument, ExecutionMode, SignalType, OptionType } from '../types';
import { getISTDateString } from '@groww-trading/shared';

/**
 * Select strike and option type based on signal and execution mode
 *
 * Deep ITM Buy:
 *   BUY (bullish)  → Call (CE) at ATM - 5 strikes (ITM Call)
 *   SELL (bearish) → Put (PE) at ATM + 5 strikes (ITM Put)
 *
 * ATM Buy:
 *   BUY  → Call (CE) at ATM
 *   SELL → Put (PE) at ATM
 *
 * ATM Sell:
 *   BUY  → Short Put (PE) at ATM
 *   SELL → Short Call (CE) at ATM
 */
export function selectStrike(
  spotPrice: number,
  signalType: SignalType,
  mode: ExecutionMode,
  strikeOffset: number,
  instruments: Instrument[],
  signalTime: Date,  // Use signal time for expiry resolution
  expiryPreference: 'WEEKLY' | 'MONTHLY' = 'WEEKLY',
  avoidExpiryDays: number = 2
): { strike: number; optionType: OptionType; optionSymbol: string; expiryDate: Date } {
  // Find index instrument for strike step
  const indexInst = instruments.find(i =>
    i.symbol === 'NIFTY' && i.instrumentType === 'INDEX' && i.isActive
  );

  const strikeStep = indexInst?.strikeStep || 50;

  // ATM = nearest strike
  const atm = Math.round(spotPrice / strikeStep) * strikeStep;

  let strike: number;
  let optionType: OptionType;

  // Branch on MODE first, then on signal
  switch (mode) {
    case 'DEEP_ITM_BUY':
      if (signalType === 'BUY') {
        // Bullish: Buy ITM Call
        strike = atm - (strikeOffset * strikeStep);
        optionType = 'CE';
      } else {
        // Bearish: Buy ITM Put
        strike = atm + (strikeOffset * strikeStep);
        optionType = 'PE';
      }
      break;

    case 'ATM_BUY':
      strike = atm;
      optionType = signalType === 'BUY' ? 'CE' : 'PE';
      break;

    case 'ATM_SELL':
      strike = atm;
      // Short the opposite: bullish→short put, bearish→short call
      optionType = signalType === 'BUY' ? 'PE' : 'CE';
      break;

    default:
      throw new Error(`Unknown execution mode: ${mode}`);
  }

  // Find matching option instrument with expiry resolution
  const optionInst = findOptionInstrument(
    instruments,
    'NIFTY',
    strike,
    optionType,
    expiryPreference,
    avoidExpiryDays,
    signalTime
  );

  if (!optionInst) {
    // In live/paper: throw - never invent symbols
    // In backtest: could fall back but log warning
    throw new Error(
      `No instrument found for ${signalType} ${mode} strike=${strike} ${optionType} at ${signalTime.toISOString()}`
    );
  }

  return {
    strike,
    optionType,
    optionSymbol: optionInst.growwToken,
    expiryDate: optionInst.expiryDate!
  };
}

/**
 * Find active option instrument matching criteria
 * Uses signalTime (not now()) for backtest correctness
 */
function findOptionInstrument(
  instruments: Instrument[],
  underlying: string,
  strike: number,
  optionType: OptionType,
  expiryPreference: 'WEEKLY' | 'MONTHLY',
  avoidExpiryDays: number,
  signalTime: Date
): Instrument | undefined {
  const signalDate = getISTDateString(signalTime);
  const signalTimeOnly = signalTime; // Keep full date for comparison

  const candidates = instruments.filter(i =>
    i.underlyingSymbol === underlying &&
    i.instrumentType === 'OPT' &&
    i.strikePrice === strike &&
    i.optionType === optionType &&
    i.isActive &&
    i.expiryDate &&  // Must have expiry
    i.validFrom && new Date(i.validFrom) <= signalTimeOnly &&
    (!i.validTo || new Date(i.validTo) >= signalTimeOnly)
  );

  if (candidates.length === 0) return undefined;

  // Sort by expiry date (nearest first)
  candidates.sort((a, b) => (a.expiryDate!.getTime() - b.expiryDate!.getTime()));

  // Filter out expiries within avoidExpiryDays
  const validCandidates = candidates.filter(c => {
    if (!c.expiryDate) return false;
    const daysToExpiry = Math.ceil((c.expiryDate.getTime() - signalTimeOnly.getTime()) / (1000 * 60 * 60 * 24));
    return daysToExpiry > avoidExpiryDays;
  });

  if (validCandidates.length === 0) return undefined;

  // Prefer weekly over monthly (or vice versa based on preference)
  if (expiryPreference === 'WEEKLY') {
    const weeklies = validCandidates.filter(c => c.expiryType === 'WEEKLY');
    return weeklies[0] || validCandidates[0];
  } else {
    const monthlies = validCandidates.filter(c => c.expiryType === 'MONTHLY');
    return monthlies[0] || validCandidates[0];
  }
}

/**
 * Get lot size for an instrument (from instrument master)
 */
export function getLotSize(
  instruments: Instrument[],
  symbol: string,
  instrumentType: 'INDEX' | 'FUT' | 'OPT',
  strike?: number,
  optionType?: OptionType
): number {
  const inst = instruments.find(i =>
    i.symbol === symbol &&
    i.instrumentType === instrumentType &&
    (strike === undefined || i.strikePrice === strike) &&
    (optionType === undefined || i.optionType === optionType) &&
    i.isActive
  );
  return inst?.lotSize || (symbol === 'NIFTY' ? 75 : 25); // Default fallback
}

/**
 * Calculate position size in quantity (lots * lot_size)
 */
export function calculateQuantity(lots: number, lotSize: number): number {
  return lots * lotSize;
}

/**
 * Calculate margin requirement for a position
 */
export interface MarginRequirement {
  span: number;
  exposure: number;
  total: number;
}

export function calculateMargin(
  mode: ExecutionMode,
  premium: number,
  lotSize: number,
  lots: number,
  spotPrice: number
): MarginRequirement {
  const quantity = lots * lotSize;

  switch (mode) {
    case 'DEEP_ITM_BUY':
    case 'ATM_BUY':
      // Long options: Premium + SPAN (small)
      const premiumValue = premium * quantity;
      const span = premiumValue * 0.1; // Approximate
      return {
        span,
        exposure: 0,
        total: premiumValue + span
      };

    case 'ATM_SELL':
      // Short options: SPAN + Exposure (large)
      // Approximate: 15-20% of contract value
      const contractValue = spotPrice * quantity;
      const spanSell = contractValue * 0.12;
      const exposure = contractValue * 0.08;
      return {
        span: spanSell,
        exposure,
        total: spanSell + exposure
      };

    default:
      return { span: 0, exposure: 0, total: 0 };
  }
}

/**
 * Get all tradable strikes for a given spot price (for data download optimization)
 * Returns strikes around ATM ± N
 */
export function getTradableStrikes(
  spotPrice: number,
  instruments: Instrument[],
  offset: number = 10
): number[] {
  const indexInst = instruments.find(i =>
    i.symbol === 'NIFTY' && i.instrumentType === 'INDEX' && i.isActive
  );
  const strikeStep = indexInst?.strikeStep || 50;
  const atm = Math.round(spotPrice / strikeStep) * strikeStep;

  const strikes: number[] = [];
  for (let i = -offset; i <= offset; i++) {
    strikes.push(atm + i * strikeStep);
  }
  return strikes;
}